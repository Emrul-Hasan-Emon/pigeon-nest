import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { TokenService } from '../../auth/services/token.service';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../../database/database.service';
import { Seller } from '../../database/entities/seller/seller.entity';
import { SellerStatus } from '../../database/enums/seller-status.enum';
import { SellerStatusChangeAction } from '../../database/enums/seller-status-change-action.enum';
import { ChangeSellerPasswordDto } from '../dtos/change-seller-password.dto';
import { SellingSwitchDto } from '../dtos/shop-break.dto';
import { UpdateSellerProfileDto } from '../dtos/update-seller-profile.dto';
import { CommonSellerService, SellerImages } from './common-seller.service';

@Injectable()
export class SellerProfileService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly commonSellerService: CommonSellerService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * The selling switch and the planned break. While selling is off, or today is inside the planned break, the seller
   * and all their products are hidden from buyers. Orders already placed carry on as usual.
   */
  async setSelling(seller: Seller, dto: SellingSwitchDto) {
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const real = (value: string, field: string) => {
      const [y, m, d] = value.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) throw new BadRequestException(`${field} is not a real date`);
    };
    const start = dto.breakStartsOn ?? null;
    const end = dto.breakEndsOn ?? null;
    if ((start === null) !== (end === null)) throw new BadRequestException('Set both the first and the last day of the break, or neither');
    if (start && end) {
      real(start, 'breakStartsOn');
      real(end, 'breakEndsOn');
      if (end < start) throw new BadRequestException('The break cannot end before it starts');
      if (end < key) throw new BadRequestException('The last day of the break cannot be in the past');
    }
    seller.isEnabledForSell = dto.isEnabledForSell;
    seller.breakStartsOn = start;
    seller.breakEndsOn = end;
    seller.breakNote = dto.note ?? null;
    await this.databaseService.seller.update(seller.id, {
      isEnabledForSell: seller.isEnabledForSell,
      breakStartsOn: seller.breakStartsOn,
      breakEndsOn: seller.breakEndsOn,
      breakNote: seller.breakNote,
    });
    return this.commonSellerService.toSellerView(seller);
  }

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

    if (dto.description !== undefined && dto.description !== seller.description) {
      seller.description = dto.description;
      changed = true;
    }

    if (!changed) {
      return this.commonSellerService.toSellerView(seller);
    }

    const resubmitting = seller.status === SellerStatus.REJECTED;
    if (resubmitting) {
      seller.status = SellerStatus.PENDING;
      seller.rejectionReason = null;
    }
    const saved = await this.commonSellerService.saveWithImages(
      seller,
      images,
      resubmitting
        ? (manager, result) =>
            this.commonSellerService.record(manager, {
              sellerId: result.id,
              fromStatus: SellerStatus.REJECTED,
              fromActiveStatus: result.activeStatus,
              toStatus: result.status,
              toActiveStatus: result.activeStatus,
              action: SellerStatusChangeAction.RESUBMITTED,
              actor: this.commonSellerService.sellerActor(result),
            })
        : undefined,
    );
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
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.databaseService.seller.update(seller.id, { passwordHash });
    // Every older token stops working with the old password. This one keeps the caller signed in.
    return { updated: true, accessToken: await this.tokens.sign(AuthUserType.SELLER, { id: seller.id, passwordHash }) };
  }
}
