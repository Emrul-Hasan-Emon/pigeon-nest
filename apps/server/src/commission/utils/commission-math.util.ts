import { BadRequestException } from '@nestjs/common';
import { CommissionType } from '../../database/enums/commission-type.enum';
import { MAX_DECIMAL_12_2 } from '../../shared/constants/limits';
import { tidy } from '../../shared/utils/money.util';

export interface CommissionRule {
  type: CommissionType;
  value: number;
}

export interface CommissionResult {
  commission: number;
  sellerAmount: number;
}

/**
 * The commission on one order: a share of the item subtotal, or a fixed amount.
 * It never goes above what the customer pays, so the seller's amount is never
 * negative (a big discount could otherwise cause that).
 */
export function commissionFor(rule: CommissionRule, subtotal: number, payable: number): CommissionResult {
  const raw = rule.type === CommissionType.PERCENTAGE ? (subtotal * rule.value) / 100 : rule.value;
  const commission = Math.min(tidy(Math.max(0, raw)), tidy(payable));
  return { commission, sellerAmount: tidy(payable - commission) };
}

/** Throws a 400 when a rule cannot be stored. */
export function assertValidRule(type: CommissionType, value: number) {
  if (!Number.isFinite(value) || value < 0) throw new BadRequestException('Commission amount cannot be negative');
  if (tidy(value) !== value) throw new BadRequestException('Commission amount can have at most 2 decimal places');
  if (value > MAX_DECIMAL_12_2) throw new BadRequestException('Commission amount is too large');
  if (type === CommissionType.PERCENTAGE && value > 100) {
    throw new BadRequestException('A percentage commission cannot be more than 100');
  }
}
