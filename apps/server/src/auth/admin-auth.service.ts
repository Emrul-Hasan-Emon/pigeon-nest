import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { AuthUserType } from '../database/enums/auth-user-type.enum';
import { AdminLoginDto } from './dtos/admin-login.dto';
import { TokenService } from './services/token.service';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly tokens: TokenService,
  ) {}

  async login(dto: AdminLoginDto) {
    const admin = await this.databaseService.adminUser.findOne({
      where: { email: dto.email },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      admin.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return {
      accessToken: await this.tokens.sign(AuthUserType.ADMIN, admin),
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    };
  }
}
