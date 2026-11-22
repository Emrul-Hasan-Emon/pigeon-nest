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
 * The commission on one order line: a share of what the line is payable at, or
 * a fixed amount per line. It never goes above the line's payable amount, so a
 * seller's share is never negative. The order's commission is the sum of its lines.
 */
export function lineCommission(rule: CommissionRule, linePayable: number): number {
  const raw = rule.type === CommissionType.PERCENTAGE ? (linePayable * rule.value) / 100 : rule.value;
  return Math.min(tidy(Math.max(0, raw)), tidy(linePayable));
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
