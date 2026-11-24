import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommonCommissionService } from './common-commission.service';
import { Seller } from '../../database/entities/seller/seller.entity';
import { SystemCommission } from '../../database/entities/commission/system-commission.entity';
import { SystemCommissionDisburse } from '../../database/entities/commission/system-commission-disburse.entity';
import { SystemCommissionDisburseAttachment } from '../../database/entities/commission/system-commission-disburse-attachment.entity';
import { SystemCommissionHistory } from '../../database/entities/commission/system-commission-history.entity';
import { CommissionStatus } from '../../database/enums/commission-status.enum';
import { CommissionHistoryType } from '../../database/enums/commission-history-type.enum';
import { PaymentStatus } from '../../database/enums/payment-status.enum';
import { OrderFileService } from '../../order/services/order-file.service';
import { Actor } from '../../shared/types/actor.type';
import { moneyGreater, tidy } from '../../shared/utils/money.util';
import { DisburseCommissionDto } from '../dtos/commission.dtos';

const FOLDER = 'commission-disbursements';

/** Admin records money a seller handed over for commission. */
@Injectable()
export class AdminCommissionDisburseService {
  constructor(
    private readonly commission: CommonCommissionService,
    private readonly files: OrderFileService,
    @InjectRepository(SystemCommission) private readonly balances: Repository<SystemCommission>,
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
  ) {}

  async record(sellerId: number, dto: DisburseCommissionDto, uploads: Express.Multer.File[] | undefined, actor: Actor) {
    // Attachments are optional.
    const list = this.files.validate(uploads);
    if (!(await this.sellers.exists({ where: { id: sellerId } }))) throw new NotFoundException('Seller not found');

    const stored = await this.files.store(list, FOLDER);
    try {
      const disburseId = await this.balances.manager.transaction(async (manager) => {
        const balance = await this.commission.lockBalance(manager, sellerId);
        if (balance.dueCommission <= 0) throw new ConflictException('This seller has no commission due');
        if (moneyGreater(dto.amount, balance.dueCommission)) {
          throw new ConflictException(`amount cannot be more than the commission due (${tidy(balance.dueCommission)})`);
        }
        const due = tidy(balance.dueCommission - dto.amount);
        const paid = tidy(balance.paidCommission + dto.amount);
        const total = balance.totalCommission;
        const creator = { createdBy: actor.id, creatorType: actor.type, creatorName: actor.name };

        const disburse = await manager.save(SystemCommissionDisburse, {
          ...creator,
          sellerId,
          amount: dto.amount,
          notes: dto.notes ?? null,
          totalAmount: total,
          dueAmount: due,
          paidAmount: paid,
        });
        if (stored.length > 0) {
          await manager.save(
            SystemCommissionDisburseAttachment,
            stored.map((s) => ({ ...s, ...creator, disburseId: disburse.id })),
          );
        }
        await this.commission.post(
          manager,
          balance,
          { due: -dto.amount, paid: dto.amount },
          CommissionStatus.COMMISSION_PAYMENT,
          actor,
          {
            ledger: {
              orderId: null,
              disburseId: disburse.id,
              type: CommissionHistoryType.COMMISSION_PAYMENT,
              totalAmount: dto.amount,
              paymentStatus: PaymentStatus.PAID,
            },
          },
        );
        return disburse.id;
      });
      return { disburseId, sellerId };
    } catch (error) {
      await this.files.discard(stored);
      throw error;
    }
  }
}
