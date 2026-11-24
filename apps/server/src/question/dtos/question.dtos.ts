import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { PageQueryDto } from '../../shared/utils/page-paginate.util';
import { emptyToUndefined, trimString } from '../../shared/utils/transform.util';

export class AskQuestionDto {
  @Transform(trimString)
  @IsString()
  @MinLength(10, { message: 'Write at least 10 characters so the seller can answer well' })
  @MaxLength(1000)
  question: string;
}

export class AnswerQuestionDto {
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  answer: string;
}

export class ModerateQuestionDto {
  @Transform(trimString)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export enum AnsweredFilter {
  ALL = 'all',
  UNANSWERED = 'unanswered',
  ANSWERED = 'answered',
}

export class ListSellerQuestionsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(AnsweredFilter)
  show?: AnsweredFilter;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(200)
  search?: string;
}

export enum QuestionVisibility {
  ALL = 'all',
  PUBLISHED = 'published',
  HIDDEN = 'hidden',
}

export class AdminListQuestionsQueryDto extends ListSellerQuestionsQueryDto {
  @IsOptional()
  @IsEnum(QuestionVisibility)
  visibility?: QuestionVisibility;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sellerId?: number;
}
