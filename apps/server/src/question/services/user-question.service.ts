import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { User } from '../../database/entities/person/user.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { QuestionStatus } from '../../database/enums/product-question.enum';
import { StorefrontProductService } from '../../storefront/storefront-product.service';
import { PageRequest, pageResult } from '../../shared/utils/page-paginate.util';
import { AskQuestionDto } from '../dtos/question.dtos';
import { CommonQuestionService } from './common-question.service';

/** A buyer may have this many unanswered questions on one product. */
const MAX_OPEN_PER_PRODUCT = 3;

/** What a shopper does with questions: read a product's, ask one, see their own. */
@Injectable()
export class UserQuestionService {
  constructor(
    private readonly db: DatabaseService,
    private readonly storefront: StorefrontProductService,
    private readonly common: CommonQuestionService,
  ) {}

  private async visibleProduct(productId: number) {
    const product = await this.storefront.eligibleProducts().andWhere('p.id = :id', { id: productId }).getOne();
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  /** Published questions on a product, newest first. Anyone may read them. */
  async listForProduct(productId: number, page: PageRequest) {
    await this.visibleProduct(productId);
    const qb = this.common
      .withRelations()
      .andWhere('q.sellerProductId = :productId', { productId })
      .andWhere('q.status = :st', { st: QuestionStatus.PUBLISHED })
      .orderBy('q.id', 'DESC');
    const [rows, total] = await qb.skip(page.offset).take(page.pageSize).getManyAndCount();
    return pageResult(rows.map((r) => this.common.publicView(r)), total, page);
  }

  async ask(user: User, productId: number, dto: AskQuestionDto) {
    const product = await this.visibleProduct(productId);
    const open = await this.db.productQuestion
      .createQueryBuilder('q')
      .where('q.userId = :uid AND q.sellerProductId = :pid AND q.answer IS NULL AND q.status = :st AND q.deletedAt IS NULL', {
        uid: user.id,
        pid: productId,
        st: QuestionStatus.PUBLISHED,
      })
      .getCount();
    if (open >= MAX_OPEN_PER_PRODUCT) {
      throw new BadRequestException('You already have questions waiting for an answer on this product. Please wait for the seller to reply.');
    }
    const saved = await this.db.productQuestion.save({
      sellerProductId: productId,
      sellerId: product.sellerId,
      userId: user.id,
      question: dto.question,
      status: QuestionStatus.PUBLISHED,
      createdBy: user.id,
      creatorType: AuthUserType.USER,
      creatorName: user.name,
    });
    const row = await this.common.withRelations().andWhere('q.id = :id', { id: saved.id }).getOneOrFail();
    return this.common.publicView(row);
  }

  /** The buyer's own questions, with the product and whether it was answered. */
  async mine(user: User, page: PageRequest) {
    const [rows, total] = await this.common
      .withRelations()
      .andWhere('q.userId = :uid', { uid: user.id })
      .orderBy('q.id', 'DESC')
      .skip(page.offset)
      .take(page.pageSize)
      .getManyAndCount();
    return pageResult(
      rows.map((r) => ({ ...this.common.staffView(r), hiddenReason: undefined })),
      total,
      page,
    );
  }
}
