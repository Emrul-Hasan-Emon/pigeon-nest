import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { SellerAuthController } from './seller-auth.controller';
import { SellerAuthService } from './seller-auth.service';
import { SellerAccessGuard } from './guards/seller-access.guard';
import { SellerModule } from '../seller/seller.module';

@Global()
@Module({
  imports: [
    SellerModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: Number(
            configService.get<string>('JWT_ACCESS_EXPIRES_IN', '900'),
          ),
        },
      }),
    }),
  ],
  controllers: [AdminAuthController, SellerAuthController],
  providers: [
    AuthGuard,
    RolesGuard,
    SellerAccessGuard,
    AdminAuthService,
    SellerAuthService,
  ],
  exports: [JwtModule, AuthGuard, RolesGuard, SellerAccessGuard],
})
export class AuthModule {}
