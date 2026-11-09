import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category/category.entity';
import { Collection } from './entities/collection/collection.entity';
import { Attribute } from './entities/attribute/attribute.entity';
import { AttributeValue } from './entities/attribute/attribute-value.entity';
import { User } from './entities/person/user.entity';
import { AdminUser } from './entities/person/admin-user.entity';
import { Address } from './entities/person/address.entity';
import { Country } from './entities/zone/country.entity';
import { Division } from './entities/zone/division.entity';
import { District } from './entities/zone/district.entity';
import { Area } from './entities/zone/area.entity';
import { ShippingZone } from './entities/zone/shipping-zone.entity';
import { Language } from './entities/language/language.entity';
import { Seller } from './entities/seller/seller.entity';
import { SellerPayout } from './entities/seller/seller-payout.entity';
import { Shop } from './entities/shop/shop.entity';
import { SellerProduct } from './entities/product/seller-product.entity';
import { SellerProductSku } from './entities/product/seller-product-sku.entity';
import { SellerProductSkuVariant } from './entities/product/seller-product-sku-variant.entity';
import { SellerProductMedia } from './entities/product-media/seller-product-media.entity';
import { Order } from './entities/order/order.entity';
import { OrderItem } from './entities/order/order-item.entity';
import { OrderStatusHistory } from './entities/order/order-status-history.entity';
import { OrderReturn } from './entities/order-return/order-return.entity';
import { OrderReturnItem } from './entities/order-return/order-return-item.entity';
import { OrderReturnStatusHistory } from './entities/order-return/order-return-status-history.entity';
import { Cart } from './entities/cart/cart.entity';
import { CartItem } from './entities/cart/cart-item.entity';
import { Coupon } from './entities/coupon/coupon.entity';
import { CouponHistoryLog } from './entities/coupon/coupon-history-log.entity';
import { Review } from './entities/review/review.entity';
import { Wishlist } from './entities/wishlist/wishlist.entity';
import { Payment } from './entities/payment/payment.entity';
import { PaymentGateway } from './entities/payment/payment-gateway.entity';
import { Banner } from './entities/banner/banner.entity';
import { HomepageSection } from './entities/homepage/homepage-section.entity';
import { PageSettings } from './entities/setting/page-settings.entity';
import { SystemSetting } from './entities/setting/system-setting.entity';
import { AuthToken } from './entities/auth/auth-token.entity';
import { AuthProvider } from './entities/auth/auth-provider.entity';
import { DatabaseService } from './database.service';

export const DATABASE_ENTITIES = [
  Category,
  Collection,
  Attribute,
  AttributeValue,
  User,
  AdminUser,
  Address,
  Country,
  Division,
  District,
  Area,
  ShippingZone,
  Language,
  Seller,
  SellerPayout,
  Shop,
  SellerProduct,
  SellerProductSku,
  SellerProductSkuVariant,
  SellerProductMedia,
  Order,
  OrderItem,
  OrderStatusHistory,
  OrderReturn,
  OrderReturnItem,
  OrderReturnStatusHistory,
  Cart,
  CartItem,
  Coupon,
  CouponHistoryLog,
  Review,
  Wishlist,
  Payment,
  PaymentGateway,
  Banner,
  HomepageSection,
  PageSettings,
  SystemSetting,
  AuthToken,
  AuthProvider,
];

@Global()
@Module({
  imports: [TypeOrmModule.forFeature(DATABASE_ENTITIES)],
  providers: [DatabaseService],
  exports: [DatabaseService, TypeOrmModule],
})
export class DatabaseModule {}
