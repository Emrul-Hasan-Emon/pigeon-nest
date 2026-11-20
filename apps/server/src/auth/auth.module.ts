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
import { UserModule } from '../user/user.module';
import { UserAuthController } from './user-auth.controller';
import { UserAuthService } from './user-auth.service';
import { UserAccessGuard } from './guards/user-access.guard';
import { OptionalCustomerGuard } from './guards/optional-customer.guard';

@Global()
@Module({
  imports: [
    SellerModule,
    UserModule,
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
  controllers: [AdminAuthController, SellerAuthController, UserAuthController],
  providers: [
    AuthGuard,
    RolesGuard,
    SellerAccessGuard,
    UserAccessGuard,
    OptionalCustomerGuard,
    AdminAuthService,
    SellerAuthService,
    UserAuthService,
  ],
  exports: [
    JwtModule,
    AuthGuard,
    RolesGuard,
    SellerAccessGuard,
    UserAccessGuard,
    OptionalCustomerGuard,
  ],
})
export class AuthModule {}
