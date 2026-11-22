import {
  Body,
  Controller,
  Get,
  Patch,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { Seller } from '../../database/entities/seller/seller.entity';
import { SellerProfileService } from '../services/seller-profile.service';
import { UpdateSellerProfileDto } from '../dtos/update-seller-profile.dto';
import { ChangeSellerPasswordDto } from '../dtos/change-seller-password.dto';
import { SellerAuthGuard } from '../../auth/guards/seller-auth.guard';

const PROFILE_FILES = FileFieldsInterceptor(
  [
    { name: 'avatar', maxCount: 1 },
    { name: 'nidFrontImage', maxCount: 1 },
    { name: 'nidBackImage', maxCount: 1 },
  ],
  { limits: { fileSize: 10 * 1024 * 1024, files: 3 } },
);

interface ProfileFiles {
  avatar?: Express.Multer.File[];
  nidFrontImage?: Express.Multer.File[];
  nidBackImage?: Express.Multer.File[];
}

@UseGuards(SellerAuthGuard, SellerAccessGuard)
@Controller({ path: 'api/seller/profile', version: '1' })
export class SellerProfileController {
  constructor(private readonly sellerProfileService: SellerProfileService) {}

  // Readable in every state (even suspended) so the seller can see why.
  @Get()
  @RequireSellerAccess('any')
  get(@CurrentSeller() seller: Seller) {
    return this.sellerProfileService.getProfile(seller);
  }

  // Multipart: name, email, phone (+countrycode), avatar, nidFrontImage, nidBackImage.
  @Patch()
  @RequireSellerAccess('profile')
  @UseInterceptors(PROFILE_FILES)
  update(
    @CurrentSeller() seller: Seller,
    @Body() dto: UpdateSellerProfileDto,
    @UploadedFiles() files?: ProfileFiles,
  ) {
    return this.sellerProfileService.updateProfile(seller, dto, {
      avatar: files?.avatar?.[0],
      nidFrontImage: files?.nidFrontImage?.[0],
      nidBackImage: files?.nidBackImage?.[0],
    });
  }

  @Patch('password')
  @RequireSellerAccess('profile')
  changePassword(
    @CurrentSeller() seller: Seller,
    @Body() dto: ChangeSellerPasswordDto,
  ) {
    return this.sellerProfileService.changePassword(seller, dto);
  }
}
