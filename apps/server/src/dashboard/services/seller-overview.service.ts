import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Seller } from '../../database/entities/seller/seller.entity';
import { tidy } from '../../shared/utils/money.util';
import { WishlistInsightsService } from '../../wishlist/services/wishlist-insights.service';
import { DashboardQueryDto } from '../dtos/dashboard.dtos';
import { resolveWindow } from '../utils/dashboard-window.util';
import { DashboardMetricsService } from './dashboard-metrics.service';

/** A SKU with this many left or fewer (and more than none) counts as running low. */
export const LOW_STOCK_AT = 5;

/** How many wishlist products the dashboard lists. */
const WISHLIST_TOP = 5;

/**
 * Everything on the seller's dashboard in one response: sales for a period, what needs doing now, the seller's
 * products and their wishlist demand. Never reads another seller's data.
 */
@Injectable()
export class SellerOverviewService {
  constructor(
    private readonly metrics: DashboardMetricsService,
    private readonly dataSource: DataSource,
    private readonly wishlist: WishlistInsightsService,
  ) {}

  async overview(seller: Seller, query: DashboardQueryDto) {
    const w = resolveWindow(query.range);
    const [totals, series, ordersByStatus, topProducts, stock, products, balance, reviews, wishlist, returns, work] = await Promise.all([
      this.metrics.compare(seller.id, w),
      this.metrics.series(seller.id, w),
      this.metrics.ordersByStatus(seller.id, w.from, w.to),
      this.metrics.topProducts(seller.id, w.from, w.to),
      this.stock(seller.id),
      this.productCounts(seller.id),
      this.balance(seller.id),
      this.reviews(seller.id),
      this.wishlist.sellerInsights(seller.id, WISHLIST_TOP),
      this.metrics.returnsInFlight(seller.id),
      this.work(seller.id),
    ]);
    const attention = this.compose(work, stock, returns, products.status.pending);
    return {
      range: w.range,
      from: w.from,
      to: w.to,
      bucket: w.bucket,
      totals,
      series,
      ordersByStatus,
      topProducts,
      attention,
      products: { ...products, totalSkus: stock.totalSkus, outOfStockSkus: stock.outOfStock },
      balance,
      reviews,
      wishlist,
    };
  }

  /** The to-do counts alone, cheap enough to poll for the alert bell on every seller page. */
  async attention(seller: Seller) {
    const [work, stock, returns, [pending]] = await Promise.all([
      this.work(seller.id),
      this.stock(seller.id),
      this.metrics.returnsInFlight(seller.id),
      this.dataSource.query<{ n: string }[]>(`select count(*) n from seller_product where "sellerId" = $1 and "deletedAt" is null and status = 'pending'`, [seller.id]),
    ]);
    return this.compose(work, stock, returns, Number(pending.n));
  }

  private compose(
    work: Awaited<ReturnType<SellerOverviewService['work']>>,
    stock: Awaited<ReturnType<SellerOverviewService['stock']>>,
    returns: { requested: number; inProgress: number },
    productsPending: number,
  ) {
    return {
      ordersToConfirm: work.toConfirm,
      ordersToPack: work.toPack,
      ordersToShip: work.toShip,
      ordersOnTheWay: work.onTheWay,
      returnRequests: returns.requested,
      returnsInProgress: returns.inProgress,
      offersWaiting: work.offersWaiting,
      outOfStockSkus: stock.outOfStock,
      lowStockSkus: stock.lowStock,
      lowStockAt: LOW_STOCK_AT,
      productsPending,
      reviewsUnanswered: work.reviewsUnanswered,
      questionsToAnswer: work.questionsToAnswer,
      paymentClaims: work.paymentClaims,
      refundsToSend: work.refundsToSend,
    };
  }

  /** Orders, offers and reviews waiting on the seller right now, whatever the period. */
  private async work(sellerId: number) {
    const [o] = await this.dataSource.query<Record<string, string>[]>(
      `select count(*) filter (where status = 'pending') to_confirm,
              count(*) filter (where status = 'confirmed') to_pack,
              count(*) filter (where status = 'packed') to_ship,
              count(*) filter (where status = 'shipped') on_the_way
         from "order" where "deletedAt" is null and "sellerId" = $1`,
      [sellerId],
    );
    const [x] = await this.dataSource.query<Record<string, string>[]>(
      `select (select count(*) from sku_price_proposal where "deletedAt" is null and "sellerId" = $1 and status = 'pending' and "awaitingParty" = 'seller') offers_waiting,
              (select count(*) from review r join seller_product p on p.id = r."sellerProductId"
                where r."deletedAt" is null and r.status = 'published' and p."sellerId" = $1 and r."replyCount" = 0) reviews_unanswered,
              (select count(*) from product_question q where q."deletedAt" is null and q.status = 'published' and q."sellerId" = $1 and q.answer is null) questions_to_answer,
              (select count(*) from payment_claim c where c."deletedAt" is null and c.status = 'pending' and c."sellerId" = $1) payment_claims,
              (select count(*) from order_refund f where f."deletedAt" is null and f.kind = 'cancelled_order' and f.status in ('needs_to_refund', 'processing') and f."sellerId" = $1) refunds_to_send`,
      [sellerId],
    );
    return {
      toConfirm: Number(o.to_confirm),
      toPack: Number(o.to_pack),
      toShip: Number(o.to_ship),
      onTheWay: Number(o.on_the_way),
      offersWaiting: Number(x.offers_waiting),
      reviewsUnanswered: Number(x.reviews_unanswered),
      questionsToAnswer: Number(x.questions_to_answer),
      paymentClaims: Number(x.payment_claims),
      refundsToSend: Number(x.refunds_to_send),
    };
  }

  /** SKUs. Out of stock and running low only count SKUs that are switched on. One query feeds both the to-do list and the product counts. */
  private async stock(sellerId: number) {
    const [s] = await this.dataSource.query<Record<string, string>[]>(
      `select count(*) total,
              count(*) filter (where k."isActive" and k.quantity <= 0) out_of_stock,
              count(*) filter (where k."isActive" and k.quantity > 0 and k.quantity <= $2) low_stock
         from seller_product_sku k join seller_product p on p.id = k."sellerProductId"
        where p."sellerId" = $1 and p."deletedAt" is null and k."deletedAt" is null`,
      [sellerId, LOW_STOCK_AT],
    );
    return { totalSkus: Number(s.total), outOfStock: Number(s.out_of_stock), lowStock: Number(s.low_stock) };
  }

  /** The seller's catalogue by review state and by activity. Deleted products are not counted. */
  private async productCounts(sellerId: number) {
    const rows = await this.dataSource.query<{ status: string; activeStatus: string; n: string }[]>(
      `select status, "activeStatus", count(*) n from seller_product where "sellerId" = $1 and "deletedAt" is null group by status, "activeStatus"`,
      [sellerId],
    );
    const status = { approved: 0, pending: 0, rejected: 0 };
    const activeStatus = { active: 0, inactive: 0, suspended: 0 };
    let total = 0;
    let visible = 0;
    let locked = 0;
    for (const r of rows) {
      const n = Number(r.n);
      total += n;
      status[r.status as keyof typeof status] += n;
      activeStatus[r.activeStatus as keyof typeof activeStatus] += n;
      // Shown on the storefront: approved and active.
      if (r.status === 'approved' && r.activeStatus === 'active') visible += n;
      // Rejected or suspended by an admin: the seller cannot change them.
      if (r.status === 'rejected' || r.activeStatus === 'suspended') locked += n;
    }
    return { totalProducts: total, status, activeStatus, visibleProducts: visible, lockedProducts: locked };
  }

  /** The commission the seller owes the platform right now. */
  private async balance(sellerId: number) {
    const [r] = await this.dataSource.query<Record<string, string>[]>(
      `select "totalCommission" total, "dueCommission" due, "paidCommission" paid from system_commission where "sellerId" = $1`,
      [sellerId],
    );
    return { total: tidy(Number(r?.total ?? 0)), due: tidy(Number(r?.due ?? 0)), paid: tidy(Number(r?.paid ?? 0)) };
  }

  /** Published reviews on the seller's products. */
  private async reviews(sellerId: number) {
    const [r] = await this.dataSource.query<Record<string, string | null>[]>(
      `select count(*) n, round(avg(r.rating)::numeric, 2) average
         from review r join seller_product p on p.id = r."sellerProductId"
        where r."deletedAt" is null and r.status = 'published' and p."sellerId" = $1`,
      [sellerId],
    );
    return { count: Number(r.n), average: r.average === null ? null : Number(r.average) };
  }
}
