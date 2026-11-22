import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ReturnScope } from '../../database/enums/return-scope.enum';
import { ReturnStatus } from '../../database/enums/return-status.enum';
import { Actor } from '../../shared/types/actor.type';
import { ListReturnsQueryDto } from '../dtos/returns.dtos';
import { CommonReturnService } from './common-return.service';
import { ReturnViewService } from './return-view.service';

export type SellerReturnStep = 'accept' | 'reject' | 'processing' | 'returning_money';

const FROM: Record<SellerReturnStep, ReturnStatus> = {
  accept: ReturnStatus.RETURN_REQUESTED,
  reject: ReturnStatus.RETURN_REQUESTED,
  processing: ReturnStatus.ACCEPTED,
  returning_money: ReturnStatus.PROCESSING,
};
const TO: Record<SellerReturnStep, ReturnStatus> = {
  accept: ReturnStatus.ACCEPTED,
  reject: ReturnStatus.REJECTED,
  processing: ReturnStatus.PROCESSING,
  returning_money: ReturnStatus.RETURNING_MONEY,
};

/** Returns on the seller's own orders: read them and take the four steps. */
@Injectable()
export class SellerReturnService {
  constructor(
    private readonly common: CommonReturnService,
    private readonly views: ReturnViewService,
  ) {}

  list(sellerId: number, query: ListReturnsQueryDto) {
    return this.views.list({ viewer: AuthUserType.SELLER, sellerId }, query);
  }

  get(sellerId: number, id: number) {
    return this.views.detail({ viewer: AuthUserType.SELLER, sellerId }, id);
  }

  /** Accept or reject, then processing, then returning the money (with optional proof files). */
  async step(
    seller: Actor,
    id: number,
    step: SellerReturnStep,
    input: { note?: string | null; includeDeliveryCharge?: boolean },
    uploads?: Express.Multer.File[],
  ) {
    // Only the money step takes files; check them either way so a bad file is always refused.
    const checked = this.common.checkFiles(uploads);
    const stored = step === 'returning_money' ? await this.common.storeFiles(checked) : [];
    try {
      await this.common.transition(id, { sellerId: seller.id }, seller, async (ret) => {
        if (ret.status !== FROM[step]) {
          throw new ConflictException(`This return is ${ret.status}; it cannot be moved with "${step}" now`);
        }
        if (input.includeDeliveryCharge !== undefined && (step !== 'accept' || ret.scope !== ReturnScope.FULL_ORDER)) {
          throw new BadRequestException('includeDeliveryCharge can only be set when accepting a full-order return');
        }
        return { to: TO[step], note: input.note ?? null, includeDeliveryCharge: input.includeDeliveryCharge, files: stored };
      });
    } catch (error) {
      await this.common.discardFiles(stored);
      throw error;
    }
    return this.get(seller.id, id);
  }
}
