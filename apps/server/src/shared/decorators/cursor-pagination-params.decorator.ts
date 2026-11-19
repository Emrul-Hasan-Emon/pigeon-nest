import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { Request } from 'express';
import { MAX_INT32 } from '../constants/limits';

export interface CursorPagination {
  cursor: number;
  limit: number;
}

// cursor defaults to 0, a sentinel meaning "first page" (ids start at 1).
// limit is fetched as limit + 1 so the service can detect a next page
// without a separate count query — see getCursorPaginateData.
export const CursorPaginationParams = createParamDecorator(
  (_data, ctx: ExecutionContext): CursorPagination => {
    const req: Request = ctx.switchToHttp().getRequest();
    const cursor = parseInt(req.query.cursor as string) || 0;
    const limit = parseInt(req.query.limit as string) || 20;

    if (
      isNaN(cursor) ||
      cursor < 0 ||
      cursor > MAX_INT32 ||
      isNaN(limit) ||
      limit < 0
    ) {
      throw new BadRequestException('Invalid pagination params');
    }
    if (limit > 100) {
      throw new BadRequestException(
        'Invalid pagination params: Max size is 100',
      );
    }

    return { cursor, limit: limit + 1 };
  },
);
