import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AdminAttributeService } from '../services/admin-attribute.service';
import { UpdateAttributeValueDto } from '../dtos/update-attribute-value.dto';
import { AdminAuthGuard } from '../../../auth/guards/admin-auth.guard';

@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/attribute-values', version: '1' })
export class AdminAttributeValueController {
  constructor(private readonly adminAttributeService: AdminAttributeService) {}

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAttributeValueDto,
  ) {
    return this.adminAttributeService.updateValue(id, dto);
  }

  // Delete is switched off for now. Remove these comment marks to bring it back.
  // @Delete(':id')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // remove(@Param('id', ParseIntPipe) id: number) {
  //   return this.adminAttributeService.removeValue(id);
  // }
}
