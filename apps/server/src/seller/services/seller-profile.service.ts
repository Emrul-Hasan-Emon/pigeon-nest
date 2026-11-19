import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../../database/database.service';
import { Seller } from '../../database/entities/seller/seller.entity';
import { SellerStatus } from '../../database/enums/seller-status.enum';
import { ChangeSellerPasswordDto } from '../dtos/change-seller-password.dto';
import { UpdateSellerProfileDto } from '../dtos/update-seller-profile.dto';
import { CommonSellerService, SellerImages } from './common-seller.service';

@Injectable()
export class SellerProfileService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly commonSellerService: CommonSellerService,
  ) {}

  getProfile(seller: Seller) {
    return this.commonSellerService.toSellerView(seller);
  }

  // A rejected seller who actually changes something goes back to pending so
  // an admin reviews the updated profile. Other statuses are unaffected.
  async updateProfile(
    seller: Seller,
    dto: UpdateSellerProfileDto,
    images?: SellerImages,
  ) {
    let changed = Boolean(
      images?.avatar || images?.nidFrontImage || images?.nidBackImage,
    );

    if (dto.name !== undefined && dto.name !== seller.name) {
      seller.name = dto.name;
      changed = true;
    }
    if (
      dto.email !== undefined &&
      dto.email.toLowerCase() !== seller.email?.toLowerCase()
    ) {
      await this.commonSellerService.assertEmailIsUnique(dto.email, seller.id);
      seller.email = dto.email;
      changed = true;
    }
    if (dto.phone !== undefined && dto.phone !== seller.phone) {
      await this.commonSellerService.assertPhoneIsUnique(dto.phone, seller.id);
      seller.phone = dto.phone;
      changed = true;
    }

    if (!changed) {
      return this.commonSellerService.toSellerView(seller);
    }

    if (seller.status === SellerStatus.REJECTED) {
      seller.status = SellerStatus.PENDING;
      seller.rejectionReason = null;
    }
    const saved = await this.commonSellerService.saveWithImages(seller, images);
    return this.commonSellerService.toSellerView(saved);
  }

  // Not a profile change: never moves a rejected seller back to pending.
  async changePassword(seller: Seller, dto: ChangeSellerPasswordDto) {
    const matches = await bcrypt.compare(dto.currentPassword, seller.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from the current one',
      );
    }
    await this.databaseService.seller.update(seller.id, {
      passwordHash: await bcrypt.hash(dto.newPassword, 10),
    });
    return { updated: true };
  }
}
