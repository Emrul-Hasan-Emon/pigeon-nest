import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { SellerAuthGuard } from '../../auth/guards/seller-auth.guard';
import { Seller } from '../../database/entities/seller/seller.entity';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { resolvePage } from '../../shared/utils/page-paginate.util';
import { AnswerQuestionDto, ListSellerQuestionsQueryDto } from '../dtos/question.dtos';
import { SellerQuestionService } from '../services/seller-question.service';

// A seller reads the questions on their own products (any state) and answers them (active sellers only).
@UseGuards(SellerAuthGuard, SellerAccessGuard)
@Controller({ path: 'api/seller/questions', version: '1' })
export class SellerQuestionController {
  constructor(private readonly questions: SellerQuestionService) {}

  @Get()
  @RequireSellerAccess('any')
  list(@CurrentSeller() seller: Seller, @Query() query: ListSellerQuestionsQueryDto) {
    return this.questions.list(seller, query, resolvePage(query));
  }

  @Get('summary')
  @RequireSellerAccess('any')
  summary(@CurrentSeller() seller: Seller) {
    return this.questions.summary(seller);
  }

  // Answers it, or changes the answer already given.
  @Post(':id/answer')
  @RequireSellerAccess('full')
  answer(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: AnswerQuestionDto) {
    return this.questions.answer(seller, id, dto);
  }
}
