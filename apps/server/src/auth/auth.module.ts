import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { SellerAuthGuard } from './guards/seller-auth.guard';
import { UserAuthGuard } from './guards/user-auth.guard';
import { TokenService } from './services/token.service';
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
    // No default secret: every sign and verify names its own role's key (see TokenService).
    JwtModule.register({}),
  ],
  controllers: [AdminAuthController, SellerAuthController, UserAuthController],
  providers: [
    TokenService,
    AdminAuthGuard,
    SellerAuthGuard,
    UserAuthGuard,
    SellerAccessGuard,
    UserAccessGuard,
    OptionalCustomerGuard,
    AdminAuthService,
    SellerAuthService,
    UserAuthService,
  ],
  exports: [
    TokenService,
    AdminAuthGuard,
    SellerAuthGuard,
    UserAuthGuard,
    SellerAccessGuard,
    UserAccessGuard,
    OptionalCustomerGuard,
  ],
})
export class AuthModule {}
