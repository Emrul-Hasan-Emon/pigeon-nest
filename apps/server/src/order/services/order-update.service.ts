import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { OrderUpdate } from '../../database/entities/order/order-update.entity';
import { OrderUpdateAttachment } from '../../database/entities/order/order-update-attachment.entity';
import { PostOrderUpdateDto } from '../dtos/order-staff.dtos';
import { OrderFileService } from './order-file.service';
import { OrderScope, StatusActor } from './order-status.service';

const FOLDER = 'order-updates';

/** A note or file from the seller or admin that the customer, seller and admin all see. */
@Injectable()
export class OrderUpdateService {
  constructor(
    private readonly db: DatabaseService,
    private readonly files: OrderFileService,
  ) {}

  async post(
    orderId: number,
    dto: PostOrderUpdateDto,
    uploads: Express.Multer.File[] | undefined,
    actor: StatusActor,
    scope: OrderScope = {},
  ) {
    const list = this.files.validate(uploads);
    if (!dto.message && list.length === 0) {
      throw new BadRequestException('Write a message or attach a file');
    }
    const order = await this.db.order.findOne({
      where: { id: orderId, ...(scope.sellerId !== undefined ? { sellerId: scope.sellerId } : {}) },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const stored = await this.files.store(list, FOLDER);
    const stamp = { createdBy: actor.id, creatorType: actor.type, creatorName: actor.name };
    try {
      const id = await this.db.orderUpdate.manager.transaction(async (manager) => {
        const update = await manager.save(OrderUpdate, { ...stamp, orderId, message: dto.message ?? null });
        if (stored.length > 0) {
          await manager.save(
            OrderUpdateAttachment,
            stored.map((s) => ({ ...s, ...stamp, orderUpdateId: update.id })),
          );
        }
        return update.id;
      });
      return { orderId, updateId: id };
    } catch (error) {
      await this.files.discard(stored);
      throw error;
    }
  }
}
