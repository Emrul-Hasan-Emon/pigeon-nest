import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { createTypeOrmConfig } from './database/config/typeorm.config';
import { FileManagementModule } from './file-management/file-management.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { SellerModule } from './seller/seller.module';
import { CommissionModule } from './commission/commission.module';
import { ContentModule } from './content/content.module';
import { StorefrontModule } from './storefront/storefront.module';
import { PaymentModule } from './payment/payment.module';
import { SettingsModule } from './settings/settings.module';
import { CartModule } from './cart/cart.module';
import { OrderModule } from './order/order.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createTypeOrmConfig,
    }),
    DatabaseModule,
    FileManagementModule,
    AuthModule,
    CatalogModule,
    SellerModule,
    CommissionModule,
    ContentModule,
    StorefrontModule,
    PaymentModule,
    SettingsModule,
    CartModule,
    OrderModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
