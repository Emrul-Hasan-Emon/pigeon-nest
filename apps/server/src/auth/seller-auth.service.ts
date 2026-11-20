import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { Seller } from '../database/entities/seller/seller.entity';
import { AuthUserType } from '../database/enums/auth-user-type.enum';
import { SellerActiveStatus } from '../database/enums/seller-active-status.enum';
import { SellerStatus } from '../database/enums/seller-status.enum';
import { SellerStatusChangeAction } from '../database/enums/seller-status-change-action.enum';
import {
  CommonSellerService,
  SellerImages,
} from '../seller/services/common-seller.service';
import { SellerStatusHistoryService } from '../seller/services/seller-status-history.service';
import { SellerLoginDto } from './dtos/seller-login.dto';
import { SellerRegisterDto } from './dtos/seller-register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

// Compared against when the phone is unknown, so response time does not
// reveal which phone numbers are registered.
const TIMING_EQUALISER_HASH =
  '$2b$10$.7Usa7N9ELixZa97r3g2MO.DDqf9pRRAqCRk5G79XlABhpfIpdFHq';

@Injectable()
export class SellerAuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly commonSellerService: CommonSellerService,
    private readonly sellerStatusHistoryService: SellerStatusHistoryService,
  ) {}

  // Any status may log in — pending, approved, rejected, inactive, suspended.
  // What they can do afterwards is decided per request by SellerAccessGuard.
  async login(dto: SellerLoginDto) {
    const seller = await this.databaseService.seller.findOne({
      where: { phone: dto.phone },
    });
    const passwordMatches = await bcrypt.compare(
      dto.password,
      seller?.passwordHash ?? TIMING_EQUALISER_HASH,
    );
    if (!seller || !passwordMatches) {
      throw new UnauthorizedException('Invalid phone number or password.');
    }
    return this.issueSession(seller);
  }

  // Self-registration: always pending + inactive, zero commission.
  async register(dto: SellerRegisterDto, images?: SellerImages) {
    await this.commonSellerService.assertPhoneIsUnique(dto.phone);
    await this.commonSellerService.assertEmailIsUnique(dto.email);

    const seller = this.databaseService.seller.create({
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      passwordHash: await bcrypt.hash(dto.password, 10),
      status: SellerStatus.PENDING,
      activeStatus: SellerActiveStatus.INACTIVE,
    });
    const saved = await this.commonSellerService.saveWithImages(
      seller,
      images,
      (manager, result) =>
        this.sellerStatusHistoryService.record(manager, {
          sellerId: result.id,
          fromStatus: null,
          fromActiveStatus: null,
          toStatus: result.status,
          toActiveStatus: result.activeStatus,
          action: SellerStatusChangeAction.REGISTERED,
          actor: this.sellerStatusHistoryService.sellerActor(result),
        }),
    );
    return this.issueSession(saved);
  }

  private async issueSession(seller: Seller) {
    const payload: JwtPayload = { sub: seller.id, type: AuthUserType.SELLER };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      seller: this.commonSellerService.toSellerView(seller),
    };
  }
}
