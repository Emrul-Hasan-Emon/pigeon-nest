import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PaymentClaimStatus } from '../../database/enums/payment-claim.enum';
import { CommonOrderService, StatusActor } from '../../order/services/common-order.service';
import { PageRequest, pageResult } from '../../shared/utils/page-paginate.util';
import { ConfirmPaymentClaimDto, ListPaymentClaimsQueryDto } from '../dtos/payment-claim.dtos';
import { CommonPaymentClaimService } from './common-payment-claim.service';

/** `sellerId` limits it to one seller's orders (a seller); leave it out for an admin. */
export interface ClaimScope {
  sellerId?: number;
}

/** The seller and the admin check "I have paid" messages: confirm one (the money is recorded) or reject it. */
@Injectable()
export class StaffPaymentClaimService {
  constructor(
    private readonly db: DatabaseService,
    private readonly common: CommonPaymentClaimService,
    private readonly payments: CommonOrderService,
  ) {}

  async list(query: ListPaymentClaimsQueryDto, page: PageRequest, scope: ClaimScope) {
    const qb = this.common.withRelations().orderBy('c.id', 'DESC');
    if (scope.sellerId !== undefined) qb.andWhere('c.sellerId = :sid', { sid: scope.sellerId });
    else if (query.sellerId) qb.andWhere('c.sellerId = :sid', { sid: query.sellerId });
    if (query.status) qb.andWhere('c.status = :st', { st: query.status });
    const [rows, total] = await qb.skip(page.offset).take(page.pageSize).getManyAndCount();
    return pageResult(rows.map((r) => this.common.staffView(r)), total, page);
  }

  /** How many messages wait to be checked. */
  async pendingCount(scope: ClaimScope) {
    return this.db.paymentClaim.count({ where: { status: PaymentClaimStatus.PENDING, ...(scope.sellerId !== undefined ? { sellerId: scope.sellerId } : {}) } });
  }

  private async pending(id: number, scope: ClaimScope) {
    const claim = await this.db.paymentClaim.findOne({ where: { id, ...(scope.sellerId !== undefined ? { sellerId: scope.sellerId } : {}) } });
    if (!claim) throw new NotFoundException('Payment message not found');
    if (claim.status !== PaymentClaimStatus.PENDING) throw new ConflictException('This payment message was already checked');
    return claim;
  }

  /** Record the money on the order. If the order cannot take it (cancelled, already paid, too much), nothing changes and the claim stays open. */
  async confirm(id: number, dto: ConfirmPaymentClaimDto, actor: StatusActor, scope: ClaimScope) {
    const claim = await this.pending(id, scope);
    const description = [`Buyer's message #${claim.id}`, claim.method ? `via ${claim.method}` : '', claim.senderNumber ? `from ${claim.senderNumber}` : '', claim.note ?? '', dto.note ?? '']
      .filter(Boolean)
      .join('. ');
    const result = await this.payments.recordWithStored(
      claim.orderId,
      { amount: dto.amount ?? claim.amount, description: description.slice(0, 1000), transactionId: claim.transactionId ?? undefined, paidAt: claim.paidOn ? new Date(`${claim.paidOn}T12:00:00`).toISOString() : undefined },
      claim.attachments ?? [],
      actor,
      scope.sellerId !== undefined ? { sellerId: scope.sellerId } : {},
    );
    claim.status = PaymentClaimStatus.CONFIRMED;
    claim.paymentId = result.paymentId;
    claim.decidedAt = new Date();
    claim.decidedByName = actor.name;
    claim.decisionNote = dto.note ?? null;
    await this.db.paymentClaim.save(claim);
    return { id: claim.id, status: claim.status, orderId: claim.orderId, paymentId: result.paymentId };
  }

  async reject(id: number, reason: string, actor: StatusActor, scope: ClaimScope) {
    const claim = await this.pending(id, scope);
    claim.status = PaymentClaimStatus.REJECTED;
    claim.decisionNote = reason;
    claim.decidedAt = new Date();
    claim.decidedByName = actor.name;
    await this.db.paymentClaim.save(claim);
    return { id: claim.id, status: claim.status };
  }
}
