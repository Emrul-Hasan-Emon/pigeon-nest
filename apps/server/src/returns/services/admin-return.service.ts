import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ReturnScope } from '../../database/enums/return-scope.enum';
import { ReturnStatus } from '../../database/enums/return-status.enum';
import { Actor } from '../../shared/types/actor.type';
import { AdminCreateReturnDto, AdminListReturnsQueryDto, AdminReturnStatusDto } from '../dtos/returns.dtos';
import { CommonReturnService } from './common-return.service';
import { ReturnViewService } from './return-view.service';

/** Every return, for admins: open one for a customer and move any return to any status. */
@Injectable()
export class AdminReturnService {
  constructor(
    private readonly common: CommonReturnService,
    private readonly views: ReturnViewService,
  ) {}

  list(query: AdminListReturnsQueryDto) {
    return this.views.list({ viewer: AuthUserType.ADMIN }, query);
  }

  get(id: number) {
    return this.views.detail({ viewer: AuthUserType.ADMIN }, id);
  }

  /** What can be returned on any order. An admin is not held to the return window. */
  eligibility(orderId: number) {
    return this.common.eligibility(orderId, 'admin');
  }

  async create(admin: Actor, dto: AdminCreateReturnDto, uploads?: Express.Multer.File[]) {
    const id = await this.common.create(dto, uploads, admin);
    return this.get(id);
  }

  /** Any status to any other, with a note. Entering or leaving `returned` moves the commission. */
  async setStatus(admin: Actor, id: number, dto: AdminReturnStatusDto, uploads?: Express.Multer.File[]) {
    const stored = await this.common.storeFiles(uploads);
    try {
      await this.common.transition(id, {}, admin, async (ret) => {
        if (dto.includeDeliveryCharge !== undefined && ret.scope !== ReturnScope.FULL_ORDER) {
          throw new BadRequestException('includeDeliveryCharge is only for full-order returns');
        }
        // The same status is allowed only to change the delivery choice of a return that is not finished.
        if (dto.status === ret.status) {
          const edits = dto.includeDeliveryCharge !== undefined && dto.includeDeliveryCharge !== ret.includeDeliveryCharge;
          if (!edits) throw new BadRequestException(`The return is already ${ret.status}`);
          if (ret.status === ReturnStatus.RETURNED) throw new ConflictException('A finished return cannot change its refund');
        }
        return { to: dto.status, note: dto.note, includeDeliveryCharge: dto.includeDeliveryCharge, files: stored };
      });
    } catch (error) {
      await this.common.discardFiles(stored);
      throw error;
    }
    return this.get(id);
  }
}
