import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ProductQuestion } from '../../database/entities/product/product-question.entity';
import { maskName } from '../../shared/utils/mask-name.util';

type Row = ProductQuestion & { product?: { id: number; name: string; slug: string } | null; user?: { name: string } | null };

/** The shapes of a question that every role shares. */
@Injectable()
export class CommonQuestionService {
  constructor(private readonly db: DatabaseService) {}

  /** What a shopper sees: a masked name, the question and the answer. */
  publicView(q: Row) {
    return {
      id: q.id,
      askerName: maskName(q.user?.name),
      question: q.question,
      answer: q.answer,
      answeredAt: q.answeredAt,
      createdAt: q.createdAt,
    };
  }

  /** What the shop and staff see: the product, the asker's masked name and the state. */
  staffView(q: Row) {
    return {
      id: q.id,
      product: q.product ? { id: q.product.id, name: q.product.name, slug: q.product.slug } : { id: q.sellerProductId, name: 'Product', slug: '' },
      askerName: maskName(q.user?.name),
      question: q.question,
      answer: q.answer,
      answeredAt: q.answeredAt,
      status: q.status,
      hiddenReason: q.hiddenReason,
      createdAt: q.createdAt,
    };
  }

  /** A question with its product and asker loaded. */
  withRelations() {
    return this.db.productQuestion
      .createQueryBuilder('q')
      .leftJoin('q.product', 'p')
      .leftJoin('q.user', 'u')
      .addSelect(['p.id', 'p.name', 'p.slug', 'u.id', 'u.name'])
      .where('q.deletedAt IS NULL');
  }
}
