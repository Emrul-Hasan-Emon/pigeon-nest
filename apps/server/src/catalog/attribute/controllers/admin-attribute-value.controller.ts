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
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { AuthUserType } from '../../../database/enums/auth-user-type.enum';
import { AdminAttributeService } from '../services/admin-attribute.service';
import { UpdateAttributeValueDto } from '../dtos/update-attribute-value.dto';

@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminAttributeService.removeValue(id);
  }
}
