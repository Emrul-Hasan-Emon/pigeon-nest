export interface CursorPage<T> {
  results: T[];
  nextCursor: number | null;
}

// `data` was fetched with `limit` = requested size + 1 (see
// CursorPaginationParams). Slicing off that extra row tells us whether a
// next page exists without a separate count query.
export function getCursorPaginateData<T extends { id: number }>(
  data: T[],
  limit: number,
): CursorPage<T> {
  const pageSize = limit - 1;
  const hasNextPage = data.length > pageSize;
  const results = data.slice(0, pageSize);

  return {
    results,
    nextCursor: hasNextPage ? results[results.length - 1].id : null,
  };
}
