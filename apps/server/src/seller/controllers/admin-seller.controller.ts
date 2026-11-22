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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import {
  CursorPaginationParams,
  CursorPagination,
} from '../../shared/decorators/cursor-pagination-params.decorator';
import { AdminSellerService } from '../services/admin-seller.service';
import { CreateSellerDto } from '../dtos/create-seller.dto';
import { UpdateSellerDto } from '../dtos/update-seller.dto';
import { ListSellerQueryDto } from '../dtos/list-seller-query.dto';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

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

@UseGuards(AdminAuthGuard)
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
  create(
    @Body() dto: CreateSellerDto,
    @CurrentUser() user: JwtPayload,
    @UploadedFiles() files?: SellerFiles,
  ) {
    return this.adminSellerService.create(
      dto,
      {
        avatar: files?.avatar?.[0],
        nidFrontImage: files?.nidFrontImage?.[0],
        nidBackImage: files?.nidBackImage?.[0],
      },
      user,
    );
  }

  @Patch(':id')
  @UseInterceptors(SELLER_FILE_FIELDS)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSellerDto,
    @CurrentUser() user: JwtPayload,
    @UploadedFiles() files?: SellerFiles,
  ) {
    return this.adminSellerService.update(
      id,
      dto,
      {
        avatar: files?.avatar?.[0],
        nidFrontImage: files?.nidFrontImage?.[0],
        nidBackImage: files?.nidBackImage?.[0],
      },
      user,
    );
  }
}
