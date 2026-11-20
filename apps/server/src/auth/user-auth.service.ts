import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { DatabaseService } from '../database/database.service';
import { User } from '../database/entities/person/user.entity';
import { AuthUserType } from '../database/enums/auth-user-type.enum';
import { UserStatus } from '../database/enums/user-status.enum';
import { CommonUserService } from '../user/services/common-user.service';
import { UserLoginDto } from './dtos/user-login.dto';
import { UserRegisterDto } from './dtos/user-register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

// Compared against when the phone is unknown, so response time does not
// reveal which phone numbers are registered.
const TIMING_EQUALISER_HASH =
  '$2b$10$.7Usa7N9ELixZa97r3g2MO.DDqf9pRRAqCRk5G79XlABhpfIpdFHq';

@Injectable()
export class UserAuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly commonUserService: CommonUserService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // Active and suspended users may both log in. What a suspended user can do
  // afterwards is decided per request by UserAccessGuard.
  async login(dto: UserLoginDto) {
    const user = await this.databaseService.user.findOne({
      where: { phone: dto.phone },
    });
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? TIMING_EQUALISER_HASH,
    );
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid phone number or password.');
    }
    return this.issueSession(user);
  }

  // Self-registration: always active. The first status log entry is written
  // in the same transaction, with the new user as its creator.
  async register(dto: UserRegisterDto) {
    await this.commonUserService.assertPhoneIsUnique(dto.phone);
    await this.commonUserService.assertEmailIsUnique(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const user = await manager.save(
          manager.create(User, {
            name: dto.name,
            phone: dto.phone,
            email: dto.email,
            passwordHash,
            status: UserStatus.ACTIVE,
            suspensionReason: null,
          }),
        );
        await this.commonUserService.recordStatusChange(manager, {
          userId: user.id,
          fromStatus: null,
          toStatus: UserStatus.ACTIVE,
          reason: 'Registered',
          actor: { id: user.id, type: AuthUserType.USER, name: user.name },
        });
        return user;
      });
      return this.issueSession(saved);
    } catch (error) {
      throw this.commonUserService.mapUniqueViolation(error);
    }
  }

  private async issueSession(user: User) {
    const payload: JwtPayload = { sub: user.id, type: AuthUserType.USER };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: this.commonUserService.toUserView(user),
    };
  }
}
