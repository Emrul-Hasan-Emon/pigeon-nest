import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category/category.entity';
import { Collection } from './entities/collection/collection.entity';
import { Attribute } from './entities/attribute/attribute.entity';
import { AttributeValue } from './entities/attribute/attribute-value.entity';
import { User } from './entities/person/user.entity';
import { AdminUser } from './entities/person/admin-user.entity';
import { UserStatusChangeHistory } from './entities/person/user-status-change-history.entity';
import { Address } from './entities/person/address.entity';
import { Country } from './entities/zone/country.entity';
import { Division } from './entities/zone/division.entity';
import { District } from './entities/zone/district.entity';
import { Area } from './entities/zone/area.entity';
import { ShippingZone } from './entities/zone/shipping-zone.entity';
import { Language } from './entities/language/language.entity';
import { Seller } from './entities/seller/seller.entity';
import { SellerPayout } from './entities/seller/seller-payout.entity';
import { SellerProductStatusChangeHistory } from './entities/product/seller-product-status-change-history.entity';
import { SellerStatusChangeHistory } from './entities/seller/seller-status-change-history.entity';
import { Shop } from './entities/shop/shop.entity';
import { SellerProduct } from './entities/product/seller-product.entity';
import { SellerProductSku } from './entities/product/seller-product-sku.entity';
import { SellerProductSkuVariant } from './entities/product/seller-product-sku-variant.entity';
import { SellerProductSkuParent } from './entities/product/seller-product-sku-parent.entity';
import { SellerProductMedia } from './entities/product-media/seller-product-media.entity';
import { Order } from './entities/order/order.entity';
import { OrderItem } from './entities/order/order-item.entity';
import { SellerSetting } from './entities/commission/seller-setting.entity';
import { SellerSettingHistory } from './entities/commission/seller-setting-history.entity';
import { SystemCommission } from './entities/commission/system-commission.entity';
import { SystemCommissionHistory } from './entities/commission/system-commission-history.entity';
import { SystemCommissionDisburse } from './entities/commission/system-commission-disburse.entity';
import { SystemCommissionDisburseAttachment } from './entities/commission/system-commission-disburse-attachment.entity';
import { OrderStatusHistory } from './entities/order/order-status-history.entity';
import { OrderReturn } from './entities/order-return/order-return.entity';
import { OrderReturnItem } from './entities/order-return/order-return-item.entity';
import { OrderReturnStatusHistory } from './entities/order-return/order-return-status-history.entity';
import { OrderReturnAttachment } from './entities/order-return/order-return-attachment.entity';
import { SystemCommissionChangeHistory } from './entities/commission/system-commission-change-history.entity';
import { Cart } from './entities/cart/cart.entity';
import { CartItem } from './entities/cart/cart-item.entity';
import { Coupon } from './entities/coupon/coupon.entity';
import { CouponHistoryLog } from './entities/coupon/coupon-history-log.entity';
import { Review } from './entities/review/review.entity';
import { ReviewAttachment } from './entities/review/review-attachment.entity';
import { ReviewEditHistory } from './entities/review/review-edit-history.entity';
import { ReviewHelpfulVote } from './entities/review/review-helpful-vote.entity';
import { ReviewReply } from './entities/review/review-reply.entity';
import { ReviewReport } from './entities/review/review-report.entity';
import { ReviewStatusHistory } from './entities/review/review-status-history.entity';
import { Wishlist } from './entities/wishlist/wishlist.entity';
import { SkuPriceProposal } from './entities/proposal/sku-price-proposal.entity';
import { SkuPriceProposalHistory } from './entities/proposal/sku-price-proposal-history.entity';
import { Payment } from './entities/payment/payment.entity';
import { PaymentAttachment } from './entities/payment/payment-attachment.entity';
import { PaymentStatusHistory } from './entities/payment/payment-status-history.entity';
import { OrderUpdate } from './entities/order/order-update.entity';
import { OrderUpdateAttachment } from './entities/order/order-update-attachment.entity';
import { PaymentGateway } from './entities/payment/payment-gateway.entity';
import { Banner } from './entities/banner/banner.entity';
import { HomepageSection } from './entities/homepage/homepage-section.entity';
import { PageSettings } from './entities/setting/page-settings.entity';
import { SystemSetting } from './entities/setting/system-setting.entity';
import { AuthToken } from './entities/auth/auth-token.entity';
import { AuthProvider } from './entities/auth/auth-provider.entity';
import { DatabaseService } from './database.service';

export const DATABASE_ENTITIES = [
  Category,
  Collection,
  Attribute,
  AttributeValue,
  User,
  UserStatusChangeHistory,
  AdminUser,
  Address,
  Country,
  Division,
  District,
  Area,
  ShippingZone,
  Language,
  Seller,
  SellerStatusChangeHistory,
  SellerProductStatusChangeHistory,
  SellerPayout,
  Shop,
  SellerProduct,
  SellerProductSku,
  SellerProductSkuVariant,
  SellerProductSkuParent,
  SellerProductMedia,
  Order,
  OrderItem,
  OrderStatusHistory,
  SellerSetting,
  SellerSettingHistory,
  SystemCommission,
  SystemCommissionHistory,
  SystemCommissionDisburse,
  SystemCommissionDisburseAttachment,
  OrderReturn,
  OrderReturnItem,
  OrderReturnStatusHistory,
  OrderReturnAttachment,
  SystemCommissionChangeHistory,
  Cart,
  CartItem,
  Coupon,
  CouponHistoryLog,
  Review,
  ReviewAttachment,
  ReviewEditHistory,
  ReviewHelpfulVote,
  ReviewReply,
  ReviewReport,
  ReviewStatusHistory,
  Wishlist,
  SkuPriceProposal,
  SkuPriceProposalHistory,
  Payment,
  PaymentGateway,
  PaymentAttachment,
  PaymentStatusHistory,
  OrderUpdate,
  OrderUpdateAttachment,
  Banner,
  HomepageSection,
  PageSettings,
  SystemSetting,
  AuthToken,
  AuthProvider,
];

@Global()
@Module({
  imports: [TypeOrmModule.forFeature(DATABASE_ENTITIES)],
  providers: [DatabaseService],
  exports: [DatabaseService, TypeOrmModule],
})
export class DatabaseModule {}
