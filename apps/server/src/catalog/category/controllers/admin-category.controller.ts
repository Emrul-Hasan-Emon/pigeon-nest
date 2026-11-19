import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  MethodNotAllowedException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { AuthUserType } from '../../../database/enums/auth-user-type.enum';
import {
  CursorPaginationParams,
  CursorPagination,
} from '../../../shared/decorators/cursor-pagination-params.decorator';
import { AdminCategoryService } from '../services/admin-category.service';
import { CreateCategoryDto } from '../dtos/create-category.dto';
import { UpdateCategoryDto } from '../dtos/update-category.dto';
import { ListCategoryQueryDto } from '../dtos/list-category-query.dto';
import { CategoryParentChainQueryDto } from '../dtos/category-parent-chain-query.dto';
import { CategoryTreeQueryDto } from '../dtos/category-tree-query.dto';

@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
@Controller({ path: 'api/admin/categories', version: '1' })
export class AdminCategoryController {
  constructor(private readonly adminCategoryService: AdminCategoryService) {}

  @Get()
  list(
    @Query() query: ListCategoryQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.adminCategoryService.list(query, pagination);
  }

  @Get('parent-chain')
  parentChain(@Query() query: CategoryParentChainQueryDto) {
    return this.adminCategoryService.parentChain(query.categoryIds);
  }

  @Get('tree')
  tree(@Query() query: CategoryTreeQueryDto) {
    return this.adminCategoryService.tree(query);
  }

  // No retrieve by design — the list row already carries every field.
  @Get(':id')
  retrieve(): never {
    throw new MethodNotAllowedException(
      'Retrieving a single category is not supported; use the list endpoint',
    );
  }

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  create(
    @Body() dto: CreateCategoryDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.adminCategoryService.create(dto, image);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('image'))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.adminCategoryService.update(id, dto, image);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminCategoryService.remove(id);
  }
}
