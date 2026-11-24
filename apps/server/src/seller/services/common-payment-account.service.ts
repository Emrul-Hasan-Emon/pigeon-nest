import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { SellerPaymentAccount } from '../../database/entities/payment/seller-payment-account.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { PaymentAccountKind } from '../../database/enums/payment-claim.enum';
import { Actor } from '../../shared/types/actor.type';
import { CreatePaymentAccountDto, UpdatePaymentAccountDto } from '../dtos/payment-account.dto';

const MAX_ACCOUNTS = 10;

/** A seller's bank and mobile money accounts. The seller and the admin use the same rules; a seller only ever reaches their own. */
@Injectable()
export class CommonPaymentAccountService {
  constructor(private readonly db: DatabaseService) {}

  view(a: SellerPaymentAccount) {
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

  async list(sellerId: number) {
    const rows = await this.db.sellerPaymentAccount.find({ where: { sellerId }, order: { id: 'ASC' } });
    return rows.map((a) => this.view(a));
  }

  async create(sellerId: number, dto: CreatePaymentAccountDto, actor: Actor) {
    const count = await this.db.sellerPaymentAccount.count({ where: { sellerId } });
    if (count >= MAX_ACCOUNTS) throw new BadRequestException(`A seller can have at most ${MAX_ACCOUNTS} payment accounts. Switch one off instead of adding another.`);
    if (dto.kind === PaymentAccountKind.BANK && !dto.accountName) throw new BadRequestException('Write the account holder name for a bank account');
    const saved = await this.db.sellerPaymentAccount.save({
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
    return this.view(saved);
  }

  async update(sellerId: number, id: number, dto: UpdatePaymentAccountDto, actor: Actor) {
    const row = await this.db.sellerPaymentAccount.findOne({ where: { id, sellerId } });
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
    return this.view(await this.db.sellerPaymentAccount.save(row));
  }
}
