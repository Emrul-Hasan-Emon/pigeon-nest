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
import {
  CursorPaginationParams,
  CursorPagination,
} from '../../../shared/decorators/cursor-pagination-params.decorator';
import { AdminCollectionService } from '../services/admin-collection.service';
import { CreateCollectionDto } from '../dtos/create-collection.dto';
import { UpdateCollectionDto } from '../dtos/update-collection.dto';
import { ListCollectionQueryDto } from '../dtos/list-collection-query.dto';
import { AdminAuthGuard } from '../../../auth/guards/admin-auth.guard';

@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/collections', version: '1' })
export class AdminCollectionController {
  constructor(
    private readonly adminCollectionService: AdminCollectionService,
  ) {}

  @Get()
  list(
    @Query() query: ListCollectionQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.adminCollectionService.list(query, pagination);
  }

  // No retrieve by design — the list row already carries every field.
  @Get(':id')
  retrieve(): never {
    throw new MethodNotAllowedException(
      'Retrieving a single collection is not supported; use the list endpoint',
    );
  }

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  create(
    @Body() dto: CreateCollectionDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.adminCollectionService.create(dto, image);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('image'))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCollectionDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.adminCollectionService.update(id, dto, image);
  }

  // Delete is switched off for now. Remove these comment marks to bring it back.
  // @Delete(':id')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // remove(@Param('id', ParseIntPipe) id: number) {
  //   return this.adminCollectionService.remove(id);
  // }
}
