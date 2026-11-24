import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { DatabaseService } from '../../database/database.service';
import { FileUploadService } from '../../file-management/file-upload.service';
import { FileInfo } from '../../file-management/types/file-info.type';
import { Seller } from '../../database/entities/seller/seller.entity';
import { getSellerAccess } from '../../auth/policies/seller-access.policy';
import { assertUploadAllowed } from '../../shared/utils/upload-validation.util';
import { SellerPaymentAccount } from '../../database/entities/payment/seller-payment-account.entity';
import { SellerStatusChangeHistory } from '../../database/entities/seller/seller-status-change-history.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { PaymentAccountKind } from '../../database/enums/payment-claim.enum';
import { SellerActiveStatus } from '../../database/enums/seller-active-status.enum';
import { SellerStatus } from '../../database/enums/seller-status.enum';
import { SellerStatusChangeAction } from '../../database/enums/seller-status-change-action.enum';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { Actor } from '../../shared/types/actor.type';
import { CreatePaymentAccountDto, UpdatePaymentAccountDto } from '../dtos/payment-account.dto';

export interface RecordStatusChangeInput {
  sellerId: number;
  fromStatus: SellerStatus | null;
  fromActiveStatus: SellerActiveStatus | null;
  toStatus: SellerStatus;
  toActiveStatus: SellerActiveStatus;
  action: SellerStatusChangeAction;
  reason?: string | null;
  actor: Actor;
}

const MAX_ACCOUNTS = 10;

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

export const FLAGS = `
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

export type Flags = Record<OnboardingKey, boolean>;

const NID_FOLDER = 'sellers/nid';
const AVATAR_FOLDER = 'sellers/avatars';
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export interface SellerImages {
  avatar?: Express.Multer.File;
  nidFrontImage?: Express.Multer.File;
  nidBackImage?: Express.Multer.File;
}

const IMAGE_FIELDS = [
  ['avatar', 'avatarPath', 'avatarUrl', AVATAR_FOLDER],
  ['nidFrontImage', 'nidFrontImagePath', 'nidFrontImageUrl', NID_FOLDER],
  ['nidBackImage', 'nidBackImagePath', 'nidBackImageUrl', NID_FOLDER],
] as const;

// Logic shared by the admin seller APIs, seller self-service and registration: seller rows and images,
// the status-change log, payment accounts and the shop set-up checklist.
@Injectable()
export class CommonSellerService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly fileUploadService: FileUploadService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findOrThrow(id: number): Promise<Seller> {
    const seller = await this.databaseService.seller.findOne({ where: { id } });
    if (!seller) {
      throw new NotFoundException('Seller not found');
    }
    return seller;
  }

  async assertEmailIsUnique(email?: string | null, excludeId?: number) {
    if (!email) return;
    const qb = this.databaseService.seller
      .createQueryBuilder('seller')
      .where('LOWER(seller.email) = LOWER(:email)', { email });
    if (excludeId) qb.andWhere('seller.id != :excludeId', { excludeId });
    if (await qb.getExists()) {
      throw new BadRequestException('A seller with this email already exists');
    }
  }

  async assertPhoneIsUnique(phone?: string | null, excludeId?: number) {
    if (!phone) return;
    const qb = this.databaseService.seller
      .createQueryBuilder('seller')
      .where('seller.phone = :phone', { phone });
    if (excludeId) qb.andWhere('seller.id != :excludeId', { excludeId });
    if (await qb.getExists()) {
      throw new BadRequestException('A seller with this phone already exists');
    }
  }

  // Validates the images, uploads them, saves the seller, then deletes the
  // replaced files. If saving fails the new uploads are removed again, so a
  // failure never leaves orphans or loses the old files.
  // `afterSave` runs inside the same transaction as the seller save (used to
  // write the status history), so both succeed or both roll back.
  async saveWithImages(
    seller: Seller,
    images?: SellerImages,
    afterSave?: (manager: EntityManager, saved: Seller) => Promise<void>,
  ): Promise<Seller> {
    for (const [field] of IMAGE_FIELDS) {
      const file = images?.[field];
      if (!file) continue;
      assertUploadAllowed(file, ['image']);
      if (file.size > IMAGE_MAX_BYTES) {
        throw new PayloadTooLargeException(`${field} must be 10MB or smaller`);
      }
    }

    const uploaded: FileInfo[] = [];
    const stalePaths: string[] = [];
    try {
      for (const [field, pathKey, urlKey, folder] of IMAGE_FIELDS) {
        const file = images?.[field];
        if (!file) continue;
        const info = await this.fileUploadService.uploadFile(file, folder);
        uploaded.push(info);
        if (seller[pathKey]) stalePaths.push(seller[pathKey]);
        seller[pathKey] = info.filePath;
        seller[urlKey] = info.fileUrl;
      }
      const saved = await this.dataSource.transaction(async (manager) => {
        const result = await manager.getRepository(Seller).save(seller);
        if (afterSave) await afterSave(manager, result);
        return result;
      });
      for (const path of stalePaths) {
        await this.fileUploadService.removeFile(path).catch(() => undefined);
      }
      return saved;
    } catch (error) {
      await this.fileUploadService.removeFiles(uploaded).catch(() => undefined);
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string } | undefined)?.code === '23505'
      ) {
        throw new BadRequestException(
          'A seller with this phone or email already exists',
        );
      }
      throw error;
    }
  }

  toSafeSeller(seller: Seller) {
    const { passwordHash: _passwordHash, ...safe } = seller;
    return safe;
  }

  // What a seller sees about themselves: safe fields + what they may do.
  toSellerView(seller: Seller) {
    return { ...this.toSafeSeller(seller), access: getSellerAccess(seller) };
  }

  // ---------------------------------------------------------------- status log (append-only)
// Writers pass the EntityManager of the transaction that changes the seller, so a change and its log row are saved together.

  // Tracker fields store the name as it is now, so the log stays readable
  // even if the person is renamed later.
  async resolveActor(user: JwtPayload): Promise<Actor> {
    if (user.type === AuthUserType.ADMIN) {
      const admin = await this.databaseService.adminUser.findOne({
        where: { id: user.sub },
        select: { id: true, name: true },
      });
      return { id: user.sub, type: user.type, name: admin?.name ?? 'Admin' };
    }
    const seller = await this.databaseService.seller.findOne({
      where: { id: user.sub },
      select: { id: true, name: true },
    });
    return { id: user.sub, type: user.type, name: seller?.name ?? 'Seller' };
  }

  sellerActor(seller: Pick<Seller, 'id' | 'name'>): Actor {
    return { id: seller.id, type: AuthUserType.SELLER, name: seller.name };
  }

  async record(manager: EntityManager, input: RecordStatusChangeInput) {
    await manager.getRepository(SellerStatusChangeHistory).insert({
      sellerId: input.sellerId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      fromActiveStatus: input.fromActiveStatus,
      toActiveStatus: input.toActiveStatus,
      action: input.action,
      reason: input.reason ?? null,
      createdBy: input.actor.id,
      creatorType: input.actor.type,
      creatorName: input.actor.name,
    });
  }

  // ---------------------------------------------------------------- payment accounts

  accountView(a: SellerPaymentAccount) {
    return {
      id: a.id,
      kind: a.kind,
      provider: a.provider,
      accountName: a.accountName,
      accountNumber: a.accountNumber,
      branchName: a.branchName,
      note: a.note,
      isActive: a.isActive,
    };
  }

  async listAccounts(sellerId: number) {
    const rows = await this.databaseService.sellerPaymentAccount.find({ where: { sellerId }, order: { id: 'ASC' } });
    return rows.map((a) => this.accountView(a));
  }

  async createAccount(sellerId: number, dto: CreatePaymentAccountDto, actor: Actor) {
    const count = await this.databaseService.sellerPaymentAccount.count({ where: { sellerId } });
    if (count >= MAX_ACCOUNTS) throw new BadRequestException(`A seller can have at most ${MAX_ACCOUNTS} payment accounts. Switch one off instead of adding another.`);
    if (dto.kind === PaymentAccountKind.BANK && !dto.accountName) throw new BadRequestException('Write the account holder name for a bank account');
    const saved = await this.databaseService.sellerPaymentAccount.save({
      sellerId,
      kind: dto.kind,
      provider: dto.provider,
      accountName: dto.accountName ?? null,
      accountNumber: dto.accountNumber,
      branchName: dto.branchName ?? null,
      note: dto.note ?? null,
      isActive: true,
      createdBy: actor.id,
      creatorType: actor.type,
      creatorName: actor.name,
    });
    return this.accountView(saved);
  }

  async updateAccount(sellerId: number, id: number, dto: UpdatePaymentAccountDto, actor: Actor) {
    const row = await this.databaseService.sellerPaymentAccount.findOne({ where: { id, sellerId } });
    if (!row) throw new NotFoundException('Payment account not found');
    if (dto.provider !== undefined) row.provider = dto.provider;
    if (dto.accountName !== undefined) row.accountName = dto.accountName;
    if (dto.accountNumber !== undefined) row.accountNumber = dto.accountNumber;
    if (dto.branchName !== undefined) row.branchName = dto.branchName;
    if (dto.note !== undefined) row.note = dto.note;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    row.updatedBy = actor.id;
    row.updaterType = actor.type as AuthUserType;
    row.updaterName = actor.name;
    return this.accountView(await this.databaseService.sellerPaymentAccount.save(row));
  }

  // ---------------------------------------------------------------- shop set-up checklist

  onboardingView(flags: Flags) {
    const steps = STEPS.map((s) => ({ ...s, done: Boolean(flags[s.key]) }));
    const done = steps.filter((s) => s.done).length;
    return { steps, done, total: steps.length, percent: Math.round((done / steps.length) * 100) };
  }

  /** One seller's checklist. */
  async onboardingFor(sellerId: number) {
    const [row] = await this.dataSource.query<Flags[]>(`select ${FLAGS} from seller s where s.id = $1 and s."deletedAt" is null`, [sellerId]);
    if (!row) throw new NotFoundException('Seller not found');
    return this.onboardingView(row);
  }
}
