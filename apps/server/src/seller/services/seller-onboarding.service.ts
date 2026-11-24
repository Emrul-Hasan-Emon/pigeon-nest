import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { likeContains } from '../../shared/utils/like.util';
import { PageRequest, pageResult } from '../../shared/utils/page-paginate.util';
import { OnboardingFilter } from '../dtos/seller-onboarding-query.dto';

/** The things a new seller does to get a shop ready. Each is true or false from what is saved. */
const STEPS = [
  { key: 'avatar', label: 'Add a profile picture', hint: 'Buyers trust a shop with a face or a logo.', href: '/seller/profile' },
  { key: 'about', label: 'Write about your shop', hint: 'Tell buyers who you are and how you keep your birds.', href: '/seller/profile' },
  { key: 'email', label: 'Add your email', hint: 'So we can reach you about orders and offers.', href: '/seller/profile' },
  { key: 'nid', label: 'Upload your ID (front and back)', hint: 'Helps the marketplace check your shop.', href: '/seller/profile' },
  { key: 'product', label: 'Add your first product', hint: 'A bird, or supplies, with a price and stock.', href: '/seller/products/new' },
  { key: 'picture', label: 'Give a product a picture', hint: 'Products with a photo sell much better.', href: '/seller/products' },
  { key: 'bird', label: 'Add bird details to a product', hint: 'Breed, bloodline, ring number or vaccination.', href: '/seller/products' },
  { key: 'live', label: 'Have a product on sale', hint: 'Approved, switched on and with stock.', href: '/seller/products' },
] as const;

export type OnboardingKey = (typeof STEPS)[number]['key'];

const FLAGS = `
  (s."avatarUrl" is not null and s."avatarUrl" <> '') as avatar,
  (s.description is not null and btrim(s.description) <> '') as about,
  (s.email is not null and s.email <> '') as email,
  (s."nidFrontImageUrl" is not null and s."nidFrontImageUrl" <> '' and s."nidBackImageUrl" is not null and s."nidBackImageUrl" <> '') as nid,
  exists (select 1 from seller_product p where p."sellerId" = s.id and p."deletedAt" is null) as product,
  exists (select 1 from seller_product p where p."sellerId" = s.id and p."deletedAt" is null and p."thumbnailUrl" is not null and p."thumbnailUrl" <> '') as picture,
  exists (select 1 from seller_product p where p."sellerId" = s.id and p."deletedAt" is null
            and (p.breed is not null or p.bloodline is not null
                 or exists (select 1 from seller_product_sku k where k."sellerProductId" = p.id and k."deletedAt" is null
                              and (k."ringNumber" is not null or k."vaccinatedOn" is not null)))) as bird,
  exists (select 1 from seller_product p where p."sellerId" = s.id and p."deletedAt" is null and p.status = 'approved' and p."activeStatus" = 'active'
            and exists (select 1 from seller_product_sku k where k."sellerProductId" = p.id and k."deletedAt" is null and k."isActive" and k.quantity > 0)) as live`;

type Flags = Record<OnboardingKey, boolean>;

/** How far a seller has got with setting up their shop. Seen by the seller, and by the admin for every seller. */
@Injectable()
export class SellerOnboardingService {
  constructor(private readonly dataSource: DataSource) {}

  private view(flags: Flags) {
    const steps = STEPS.map((s) => ({ ...s, done: Boolean(flags[s.key]) }));
    const done = steps.filter((s) => s.done).length;
    return { steps, done, total: steps.length, percent: Math.round((done / steps.length) * 100) };
  }

  /** One seller's checklist. */
  async forSeller(sellerId: number) {
    const [row] = await this.dataSource.query<Flags[]>(`select ${FLAGS} from seller s where s.id = $1 and s."deletedAt" is null`, [sellerId]);
    if (!row) throw new NotFoundException('Seller not found');
    return this.view(row);
  }

  /** Every approved seller with how much of the checklist they have done, least done first. */
  async list(search: string | undefined, show: OnboardingFilter | undefined, page: PageRequest) {
    const rows = await this.dataSource.query<(Flags & { id: number; name: string; phone: string | null; createdAt: Date })[]>(
      `select s.id, s.name, s.phone, s."createdAt", ${FLAGS} from seller s
        where s."deletedAt" is null and s.status = 'approved' and ($1::text is null or s.name ilike $1 or s.phone ilike $1)`,
      [search ? likeContains(search) : null],
    );
    const all = rows
      .map((r) => ({ id: r.id, name: r.name, phone: r.phone, joinedAt: r.createdAt, ...this.view(r) }))
      .filter((r) => (show === OnboardingFilter.COMPLETE ? r.percent === 100 : show === OnboardingFilter.INCOMPLETE ? r.percent < 100 : true))
      .sort((a, b) => a.percent - b.percent || b.id - a.id);
    const results = all.slice(page.offset, page.offset + page.pageSize).map((r) => ({
      ...r,
      missing: r.steps.filter((s) => !s.done).map((s) => s.label),
      steps: undefined,
    }));
    const average = all.length ? Math.round(all.reduce((t, r) => t + r.percent, 0) / all.length) : 0;
    return { ...pageResult(results, all.length, page), summary: { sellers: all.length, complete: all.filter((r) => r.percent === 100).length, averagePercent: average } };
  }
}
