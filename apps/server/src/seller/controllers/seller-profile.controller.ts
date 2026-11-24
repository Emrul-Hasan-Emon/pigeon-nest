import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { Seller } from '../../database/entities/seller/seller.entity';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { CreatePaymentAccountDto, UpdatePaymentAccountDto } from '../dtos/payment-account.dto';
import { CommonSellerService } from '../services/common-seller.service';
import { SellerProfileService } from '../services/seller-profile.service';
import { SellingSwitchDto } from '../dtos/shop-break.dto';
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

// A seller's own account: profile, selling switch, password, shop set-up checklist and payment accounts.
@UseGuards(SellerAuthGuard, SellerAccessGuard)
@Controller({ path: 'api/seller/profile', version: '1' })
export class SellerProfileController {
  constructor(
    private readonly sellerProfileService: SellerProfileService,
    private readonly common: CommonSellerService,
  ) {}

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

  // Switch selling on or off, and plan a break with a start and an end date.
  @Patch('selling')
  @RequireSellerAccess('profile')
  setSelling(@CurrentSeller() seller: Seller, @Body() dto: SellingSwitchDto) {
    return this.sellerProfileService.setSelling(seller, dto);
  }

  @Patch('password')
  @RequireSellerAccess('profile')
  changePassword(
    @CurrentSeller() seller: Seller,
    @Body() dto: ChangeSellerPasswordDto,
  ) {
    return this.sellerProfileService.changePassword(seller, dto);
  }

  // The "get your shop ready" checklist. Readable in every state.
  @Get('onboarding')
  @RequireSellerAccess('any')
  getOnboarding(@CurrentSeller() seller: Seller) {
    return this.common.onboardingFor(seller.id);
  }

  // Bank and mobile money accounts: what buyers see on an order when they have to pay.
  @Get('payment-accounts')
  @RequireSellerAccess('any')
  listAccounts(@CurrentSeller() seller: Seller) {
    return this.common.listAccounts(seller.id);
  }

  @Post('payment-accounts')
  @RequireSellerAccess('profile')
  createAccount(@CurrentSeller() seller: Seller, @Body() dto: CreatePaymentAccountDto) {
    return this.common.createAccount(seller.id, dto, { id: seller.id, type: AuthUserType.SELLER, name: seller.name });
  }

  // Change an account, or switch it off with { isActive: false }.
  @Patch('payment-accounts/:id')
  @RequireSellerAccess('profile')
  updateAccount(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: UpdatePaymentAccountDto) {
    return this.common.updateAccount(seller.id, id, dto, { id: seller.id, type: AuthUserType.SELLER, name: seller.name });
  }
}
