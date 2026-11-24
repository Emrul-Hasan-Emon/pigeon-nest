import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { QuestionStatus } from '../../database/enums/product-question.enum';
import { likeContains } from '../../shared/utils/like.util';
import { PageRequest, pageResult } from '../../shared/utils/page-paginate.util';
import { AdminListQuestionsQueryDto, AnsweredFilter, QuestionVisibility } from '../dtos/question.dtos';
import { CommonQuestionService } from './common-question.service';

/** A moderator reads every question, and can hide one that breaks the rules. Admins never answer for a seller. */
@Injectable()
export class AdminQuestionService {
  constructor(
    private readonly db: DatabaseService,
    private readonly common: CommonQuestionService,
  ) {}

  async list(query: AdminListQuestionsQueryDto, page: PageRequest) {
    const qb = this.common.withRelations().leftJoin('q.seller', 's').addSelect(['s.id', 's.name']).orderBy('q.id', 'DESC');
    if (query.visibility === QuestionVisibility.HIDDEN) qb.andWhere('q.status = :st', { st: QuestionStatus.HIDDEN });
    else if (query.visibility === QuestionVisibility.PUBLISHED) qb.andWhere('q.status = :st', { st: QuestionStatus.PUBLISHED });
    if (query.show === AnsweredFilter.UNANSWERED) qb.andWhere('q.answer IS NULL');
    if (query.show === AnsweredFilter.ANSWERED) qb.andWhere('q.answer IS NOT NULL');
    if (query.sellerId) qb.andWhere('q.sellerId = :sid', { sid: query.sellerId });
    if (query.search) qb.andWhere('(q.question ILIKE :s OR p.name ILIKE :s OR s.name ILIKE :s)', { s: likeContains(query.search) });
    const [rows, total] = await qb.skip(page.offset).take(page.pageSize).getManyAndCount();
    return pageResult(
      rows.map((r) => ({ ...this.common.staffView(r), seller: { id: r.sellerId, name: r.seller?.name ?? 'Seller' } })),
      total,
      page,
    );
  }

  async hide(id: number, reason: string, actor: { id: number; name: string }) {
    const row = await this.db.productQuestion.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Question not found');
    if (row.status === QuestionStatus.HIDDEN) throw new ConflictException('This question is already hidden');
    row.status = QuestionStatus.HIDDEN;
    row.hiddenReason = reason;
    row.hiddenAt = new Date();
    row.updatedBy = actor.id;
    row.updaterName = actor.name;
    await this.db.productQuestion.save(row);
    return { id, status: row.status };
  }

  async restore(id: number, actor: { id: number; name: string }) {
    const row = await this.db.productQuestion.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Question not found');
    if (row.status === QuestionStatus.PUBLISHED) throw new ConflictException('This question is not hidden');
    row.status = QuestionStatus.PUBLISHED;
    row.hiddenReason = null;
    row.hiddenAt = null;
    row.updatedBy = actor.id;
    row.updaterName = actor.name;
    await this.db.productQuestion.save(row);
    return { id, status: row.status };
  }
}
