import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Seller } from '../../database/entities/seller/seller.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { QuestionStatus } from '../../database/enums/product-question.enum';
import { likeContains } from '../../shared/utils/like.util';
import { PageRequest, pageResult } from '../../shared/utils/page-paginate.util';
import { AnsweredFilter, AnswerQuestionDto, ListSellerQuestionsQueryDto } from '../dtos/question.dtos';
import { CommonQuestionService } from './common-question.service';

/** A seller reads the questions on their own products and answers them. Never another seller's. */
@Injectable()
export class SellerQuestionService {
  constructor(
    private readonly db: DatabaseService,
    private readonly common: CommonQuestionService,
  ) {}

  async list(seller: Seller, query: ListSellerQuestionsQueryDto, page: PageRequest) {
    const qb = this.common
      .withRelations()
      .andWhere('q.sellerId = :sid', { sid: seller.id })
      .andWhere('q.status = :st', { st: QuestionStatus.PUBLISHED })
      .orderBy('q.id', 'DESC');
    if (query.show === AnsweredFilter.UNANSWERED) qb.andWhere('q.answer IS NULL');
    if (query.show === AnsweredFilter.ANSWERED) qb.andWhere('q.answer IS NOT NULL');
    if (query.search) qb.andWhere('(q.question ILIKE :s OR p.name ILIKE :s)', { s: likeContains(query.search) });
    const [rows, total] = await qb.skip(page.offset).take(page.pageSize).getManyAndCount();
    return pageResult(rows.map((r) => this.common.staffView(r)), total, page);
  }

  /** How many questions wait for an answer. */
  async summary(seller: Seller) {
    const count = (answered: boolean) =>
      this.db.productQuestion
        .createQueryBuilder('q')
        .where(`q.sellerId = :sid AND q.status = :st AND q.deletedAt IS NULL AND q.answer IS ${answered ? 'NOT NULL' : 'NULL'}`, { sid: seller.id, st: QuestionStatus.PUBLISHED })
        .getCount();
    const [unanswered, answered] = await Promise.all([count(false), count(true)]);
    return { unanswered, answered };
  }

  /** Answer a question, or change the answer already given. */
  async answer(seller: Seller, id: number, dto: AnswerQuestionDto) {
    const row = await this.db.productQuestion.findOne({ where: { id, sellerId: seller.id } });
    if (!row) throw new NotFoundException('Question not found');
    if (row.status !== QuestionStatus.PUBLISHED) throw new ConflictException('This question was hidden by a moderator');
    row.answer = dto.answer;
    row.answeredAt = row.answeredAt ?? new Date();
    row.updatedBy = seller.id;
    row.updaterType = AuthUserType.SELLER;
    row.updaterName = seller.name;
    await this.db.productQuestion.save(row);
    const full = await this.common.withRelations().andWhere('q.id = :id', { id }).getOneOrFail();
    return this.common.staffView(full);
  }
}
