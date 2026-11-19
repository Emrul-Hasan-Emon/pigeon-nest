import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import {
  CursorPaginationParams,
  CursorPagination,
} from '../../shared/decorators/cursor-pagination-params.decorator';
import { AdminSellerService } from '../services/admin-seller.service';
import { CreateSellerDto } from '../dtos/create-seller.dto';
import { UpdateSellerDto } from '../dtos/update-seller.dto';
import { ListSellerQueryDto } from '../dtos/list-seller-query.dto';

const SELLER_FILE_FIELDS = FileFieldsInterceptor([
  { name: 'avatar', maxCount: 1 },
  { name: 'nidFrontImage', maxCount: 1 },
  { name: 'nidBackImage', maxCount: 1 },
]);

interface SellerFiles {
  avatar?: Express.Multer.File[];
  nidFrontImage?: Express.Multer.File[];
  nidBackImage?: Express.Multer.File[];
}

@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
@Controller({ path: 'api/admin/sellers', version: '1' })
export class AdminSellerController {
  constructor(private readonly adminSellerService: AdminSellerService) {}

  @Get()
  list(
    @Query() query: ListSellerQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.adminSellerService.list(query, pagination);
  }

  @Get(':id')
  details(@Param('id', ParseIntPipe) id: number) {
    return this.adminSellerService.details(id);
  }

  @Post()
  @UseInterceptors(SELLER_FILE_FIELDS)
  create(@Body() dto: CreateSellerDto, @UploadedFiles() files?: SellerFiles) {
    return this.adminSellerService.create(dto, {
      avatar: files?.avatar?.[0],
      nidFrontImage: files?.nidFrontImage?.[0],
      nidBackImage: files?.nidBackImage?.[0],
    });
  }

  @Patch(':id')
  @UseInterceptors(SELLER_FILE_FIELDS)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSellerDto,
    @UploadedFiles() files?: SellerFiles,
  ) {
    return this.adminSellerService.update(id, dto, {
      avatar: files?.avatar?.[0],
      nidFrontImage: files?.nidFrontImage?.[0],
      nidBackImage: files?.nidBackImage?.[0],
    });
  }
}
