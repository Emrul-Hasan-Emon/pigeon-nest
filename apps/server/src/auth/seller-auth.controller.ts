import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { SellerAuthService } from './seller-auth.service';
import { SellerLoginDto } from './dtos/seller-login.dto';
import { SellerRegisterDto } from './dtos/seller-register.dto';

const REGISTER_FILES = FileFieldsInterceptor(
  [
    { name: 'avatar', maxCount: 1 },
    { name: 'nidFrontImage', maxCount: 1 },
    { name: 'nidBackImage', maxCount: 1 },
  ],
  { limits: { fileSize: 10 * 1024 * 1024, files: 3 } },
);

interface RegisterFiles {
  avatar?: Express.Multer.File[];
  nidFrontImage?: Express.Multer.File[];
  nidBackImage?: Express.Multer.File[];
}

// Public endpoints — no token needed.
@Controller({ path: 'api/seller/auth', version: '1' })
export class SellerAuthController {
  constructor(private readonly sellerAuthService: SellerAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: SellerLoginDto) {
    return this.sellerAuthService.login(dto);
  }

  // Multipart: name, phone (+countrycode), password, optional email and files.
  @Post('register')
  @UseInterceptors(REGISTER_FILES)
  register(
    @Body() dto: SellerRegisterDto,
    @UploadedFiles() files?: RegisterFiles,
  ) {
    return this.sellerAuthService.register(dto, {
      avatar: files?.avatar?.[0],
      nidFrontImage: files?.nidFrontImage?.[0],
      nidBackImage: files?.nidBackImage?.[0],
    });
  }
}
