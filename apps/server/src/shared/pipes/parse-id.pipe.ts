import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { MAX_INT32 } from '../constants/limits';

// Strict positive int32 for `:id` params. Stricter than ParseIntPipe, which
// accepts values the database column cannot hold and turns them into a 500.
@Injectable()
export class ParseIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException('id must be a positive integer');
    }
    const id = Number(value);
    if (id < 1 || id > MAX_INT32) {
      throw new BadRequestException('id is out of range');
    }
    return id;
  }
}
