import { ConflictException, Injectable } from '@nestjs/common';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ReturnStatus } from '../../database/enums/return-status.enum';
import { Actor } from '../../shared/types/actor.type';
import { CreateReturnDto, ListReturnsQueryDto } from '../dtos/returns.dtos';
import { CommonReturnService } from './common-return.service';
import { ReturnViewService } from './return-view.service';

/** A customer's own returns: ask, follow, and cancel while it is still only requested. */
@Injectable()
export class UserReturnService {
  constructor(
    private readonly common: CommonReturnService,
    private readonly views: ReturnViewService,
  ) {}

  list(userId: number, query: ListReturnsQueryDto) {
    return this.views.list({ viewer: AuthUserType.USER, userId }, query);
  }

  get(userId: number, id: number) {
    return this.views.detail({ viewer: AuthUserType.USER, userId }, id);
  }

  /** What can be returned on one of the customer's orders, and what each choice refunds. */
  eligibility(userId: number, orderId: number) {
    return this.common.eligibility(orderId, 'user', userId);
  }

  async create(user: Actor, dto: CreateReturnDto, uploads?: Express.Multer.File[]) {
    const id = await this.common.create(dto, uploads, user);
    return this.get(user.id, id);
  }

  /** The customer withdraws a request that nobody has answered yet. */
  async cancel(user: Actor, id: number, note?: string) {
    await this.common.transition(id, { userId: user.id }, user, async (ret) => {
      if (ret.status !== ReturnStatus.RETURN_REQUESTED) {
        throw new ConflictException('A return can only be cancelled while it is still requested');
      }
      return { to: ReturnStatus.CANCELLED, note: note ?? null };
    });
    return this.get(user.id, id);
  }
}
