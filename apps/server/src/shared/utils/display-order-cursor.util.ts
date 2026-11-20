import { SelectQueryBuilder } from 'typeorm';

// Orders by (sortOrder, id) ascending and keeps the plain id cursor: the page
// after `cursor` is every row whose (sortOrder, id) is greater than the cursor
// row's. A cursor pointing at a deleted row yields an empty page.
export function applyDisplayOrderCursor<T extends object>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  tableName: string,
  cursor: number,
): void {
  qb.orderBy(`${alias}.sortOrder`, 'ASC').addOrderBy(`${alias}.id`, 'ASC');
  if (cursor > 0) {
    qb.andWhere(
      `(${alias}."sortOrder", ${alias}.id) > (SELECT c."sortOrder", c.id FROM "${tableName}" c WHERE c.id = :cursor)`,
      { cursor },
    );
  }
}
