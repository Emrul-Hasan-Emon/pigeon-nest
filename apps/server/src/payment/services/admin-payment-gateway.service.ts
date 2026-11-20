import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PaymentGateway } from '../../database/entities/payment/payment-gateway.entity';
import { PaymentGatewayType } from '../../database/enums/payment-gateway-type.enum';
import { FileUploadService } from '../../file-management/file-upload.service';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { likeContains } from '../../shared/utils/like.util';
import { slugify } from '../../shared/utils/slugify.util';
import { assertUploadAllowed } from '../../shared/utils/upload-validation.util';
import {
  CreatePaymentGatewayDto,
  ListPaymentGatewayQueryDto,
  UpdatePaymentGatewayDto,
} from '../dtos/payment-gateway.dtos';
import {
  ACCOUNT_FIELD_LABELS,
  AccountField,
  GATEWAY_RULES,
  proofFieldsFor,
} from '../utils/payment-gateway.util';

const ICON_FOLDER = 'payment-gateways';
const ICON_MAX_BYTES = 2 * 1024 * 1024;
const ACCOUNT_FIELDS: AccountField[] = ['accountName', 'accountNumber', 'bankName', 'branchName'];

type AccountValues = Partial<Record<AccountField, string | null>>;

@Injectable()
export class AdminPaymentGatewayService {
  constructor(
    private readonly db: DatabaseService,
    private readonly fileUpload: FileUploadService,
  ) {}

  async list(query: ListPaymentGatewayQueryDto, pagination: CursorPagination) {
    const qb = this.db.paymentGateway
      .createQueryBuilder('g')
      .orderBy('g.id', 'DESC')
      .take(pagination.limit);
    if (pagination.cursor > 0) qb.andWhere('g.id < :cursor', { cursor: pagination.cursor });
    if (query.search) qb.andWhere('g.name ILIKE :q', { q: likeContains(query.search) });
    if (query.type) qb.andWhere('g.type = :type', { type: query.type });
    if (query.isActive !== undefined) qb.andWhere('g.isActive = :a', { a: query.isActive });

    const page = getCursorPaginateData(await qb.getMany(), pagination.limit);
    return { ...page, results: page.results.map((g) => this.view(g)) };
  }

  async details(id: number) {
    return this.view(await this.findOrThrow(id));
  }

  async create(dto: CreatePaymentGatewayDto, icon?: Express.Multer.File) {
    this.assertRules(dto.type, dto.description ?? null, dto);
    if (icon) this.assertIcon(icon);
    await this.assertNameFree(dto.name);

    const gateway = this.db.paymentGateway.create({
      name: dto.name,
      slug: await this.uniqueSlug(dto.name),
      type: dto.type,
      isManual: true,
      description: dto.description ?? null,
      accountName: dto.accountName,
      accountNumber: dto.accountNumber,
      bankName: dto.bankName,
      branchName: dto.branchName,
      isActive: dto.isActive ?? true,
    });
    if (icon) {
      const info = await this.fileUpload.uploadFile(icon, ICON_FOLDER);
      gateway.iconUrl = info.fileUrl;
      gateway.iconPath = info.filePath;
    }
    try {
      return this.view(await this.db.paymentGateway.save(gateway));
    } catch (error) {
      if (gateway.iconPath) await this.fileUpload.removeFile(gateway.iconPath).catch(() => undefined);
      throw error;
    }
  }

  async update(id: number, dto: UpdatePaymentGatewayDto, icon?: Express.Multer.File) {
    const gateway = await this.findOrThrow(id);
    if (icon) this.assertIcon(icon);
    if (icon && dto.removeIcon) {
      throw new BadRequestException('icon and removeIcon cannot be used together');
    }
    if (dto.name !== undefined && dto.name.toLowerCase() !== gateway.name.toLowerCase()) {
      await this.assertNameFree(dto.name, id);
    }

    // Validate the type rules against the values the gateway will have after the update.
    const next = {
      type: dto.type ?? gateway.type,
      description: dto.description !== undefined ? dto.description : gateway.description,
      accounts: Object.fromEntries(
        ACCOUNT_FIELDS.map((f) => [f, dto[f] !== undefined ? dto[f] : gateway[f]]),
      ) as AccountValues,
    };
    this.assertRules(next.type, next.description, next.accounts);

    if (dto.name !== undefined) gateway.name = dto.name; // the slug stays: orders refer to it
    gateway.type = next.type;
    gateway.description = next.description ?? null;
    for (const f of ACCOUNT_FIELDS) gateway[f] = (next.accounts[f] ?? null) as string;
    if (dto.isActive !== undefined) gateway.isActive = dto.isActive;

    const stale: string[] = [];
    let uploaded: string | undefined;
    if (icon) {
      const info = await this.fileUpload.uploadFile(icon, ICON_FOLDER);
      uploaded = info.filePath;
      if (gateway.iconPath) stale.push(gateway.iconPath);
      gateway.iconUrl = info.fileUrl;
      gateway.iconPath = info.filePath;
    } else if (dto.removeIcon) {
      if (gateway.iconPath) stale.push(gateway.iconPath);
      gateway.iconUrl = null as unknown as string;
      gateway.iconPath = null as unknown as string;
    }
    try {
      const saved = await this.db.paymentGateway.save(gateway);
      for (const path of stale) await this.fileUpload.removeFile(path).catch(() => undefined);
      return this.view(saved);
    } catch (error) {
      if (uploaded) await this.fileUpload.removeFile(uploaded).catch(() => undefined);
      throw error;
    }
  }

  async remove(id: number) {
    const gateway = await this.findOrThrow(id);
    const orders = await this.db.order.count({ where: { paymentGatewayId: id } });
    const payments = await this.db.payment.count({ where: { paymentGatewayId: id } });
    if (orders + payments > 0) {
      throw new ConflictException(
        'This gateway is used by orders or payments and cannot be deleted. Deactivate it instead.',
      );
    }
    await this.db.paymentGateway.delete(id);
    if (gateway.iconPath) await this.fileUpload.removeFile(gateway.iconPath).catch(() => undefined);
  }

  private async findOrThrow(id: number) {
    const gateway = await this.db.paymentGateway.findOne({ where: { id } });
    if (!gateway) throw new NotFoundException('Payment gateway not found');
    return gateway;
  }

  /** Which account details a type allows / needs, and whether it needs instructions. */
  private assertRules(type: PaymentGatewayType, description: string | null, accounts: AccountValues) {
    const rule = GATEWAY_RULES[type];
    for (const f of ACCOUNT_FIELDS) {
      const filled = !!accounts[f];
      if (filled && !rule.allowed.includes(f)) {
        throw new BadRequestException(
          `${ACCOUNT_FIELD_LABELS[f]} is not used by ${type} gateways`,
        );
      }
      if (!filled && rule.required.includes(f)) {
        throw new BadRequestException(`${ACCOUNT_FIELD_LABELS[f]} is required for ${type} gateways`);
      }
    }
    if (rule.needsDescription && !description) {
      throw new BadRequestException(`Payment instructions (description) are required for ${type} gateways`);
    }
  }

  private assertIcon(file: Express.Multer.File) {
    assertUploadAllowed(file, ['image']);
    if (file.size > ICON_MAX_BYTES) {
      throw new PayloadTooLargeException('The icon must be 2MB or smaller');
    }
  }

  private async assertNameFree(name: string, exceptId?: number) {
    const qb = this.db.paymentGateway
      .createQueryBuilder('g')
      .where('LOWER(g.name) = LOWER(:name)', { name });
    if (exceptId) qb.andWhere('g.id <> :id', { id: exceptId });
    if ((await qb.getCount()) > 0) {
      throw new ConflictException('A payment gateway with this name already exists');
    }
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || 'gateway';
    for (let i = 0; i < 50; i++) {
      const slug = i === 0 ? base : `${base}-${i + 1}`;
      // include soft-deleted rows: the unique constraint covers them too
      const taken = await this.db.paymentGateway.count({ where: { slug }, withDeleted: true });
      if (!taken) return slug;
    }
    throw new ConflictException('Could not generate a unique slug');
  }

  private view(g: PaymentGateway) {
    return {
      id: g.id,
      name: g.name,
      slug: g.slug,
      type: g.type,
      description: g.description ?? null,
      iconUrl: g.iconUrl ?? null,
      accountName: g.accountName ?? null,
      accountNumber: g.accountNumber ?? null,
      bankName: g.bankName ?? null,
      branchName: g.branchName ?? null,
      isActive: g.isActive,
      // What the customer must enter at checkout for this gateway.
      proofFields: proofFieldsFor(g.type),
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    };
  }
}
