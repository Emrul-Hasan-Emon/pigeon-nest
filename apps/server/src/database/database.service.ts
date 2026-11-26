import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category/category.entity';
import { Collection } from './entities/collection/collection.entity';
import { Attribute } from './entities/attribute/attribute.entity';
import { AttributeValue } from './entities/attribute/attribute-value.entity';
import { User } from './entities/person/user.entity';
import { AdminUser } from './entities/person/admin-user.entity';
import { UserStatusChangeHistory } from './entities/person/user-status-change-history.entity';
import { Address } from './entities/person/address.entity';
import { Country } from './entities/zone/country.entity';
import { Division } from './entities/zone/division.entity';
import { District } from './entities/zone/district.entity';
import { Area } from './entities/zone/area.entity';
import { ShippingZone } from './entities/zone/shipping-zone.entity';
import { Language } from './entities/language/language.entity';
import { Seller } from './entities/seller/seller.entity';
import { SellerPayout } from './entities/seller/seller-payout.entity';
import { SellerProductStatusChangeHistory } from './entities/product/seller-product-status-change-history.entity';
import { SellerStatusChangeHistory } from './entities/seller/seller-status-change-history.entity';
import { Shop } from './entities/shop/shop.entity';
import { SellerProduct } from './entities/product/seller-product.entity';
import { SellerProductSku } from './entities/product/seller-product-sku.entity';
import { SellerProductSkuVariant } from './entities/product/seller-product-sku-variant.entity';
import { ProductQuestion } from './entities/product/product-question.entity';
import { StockMovement } from './entities/product/stock-movement.entity';
import { OrderRefund } from './entities/order/order-refund.entity';
import { OrderRefundStatusHistory } from './entities/order/order-refund-status-history.entity';
import { PaymentClaim } from './entities/payment/payment-claim.entity';
import { SellerPaymentAccount } from './entities/payment/seller-payment-account.entity';
import { SellerDevice } from './entities/seller/seller-device.entity';
import { UserDevice } from './entities/person/user-device.entity';
import { SellerProductSkuParent } from './entities/product/seller-product-sku-parent.entity';
import { SellerProductMedia } from './entities/product-media/seller-product-media.entity';
import { Order } from './entities/order/order.entity';
import { OrderItem } from './entities/order/order-item.entity';
import { OrderStatusHistory } from './entities/order/order-status-history.entity';
import { OrderReturn } from './entities/order-return/order-return.entity';
import { OrderReturnItem } from './entities/order-return/order-return-item.entity';
import { OrderReturnStatusHistory } from './entities/order-return/order-return-status-history.entity';
import { OrderReturnAttachment } from './entities/order-return/order-return-attachment.entity';
import { SystemCommissionChangeHistory } from './entities/commission/system-commission-change-history.entity';
import { Cart } from './entities/cart/cart.entity';
import { CartItem } from './entities/cart/cart-item.entity';
import { Coupon } from './entities/coupon/coupon.entity';
import { CouponHistoryLog } from './entities/coupon/coupon-history-log.entity';
import { Review } from './entities/review/review.entity';
import { Wishlist } from './entities/wishlist/wishlist.entity';
import { Payment } from './entities/payment/payment.entity';
import { PaymentAttachment } from './entities/payment/payment-attachment.entity';
import { PaymentStatusHistory } from './entities/payment/payment-status-history.entity';
import { OrderUpdate } from './entities/order/order-update.entity';
import { OrderUpdateAttachment } from './entities/order/order-update-attachment.entity';
import { PaymentGateway } from './entities/payment/payment-gateway.entity';
import { Banner } from './entities/banner/banner.entity';
import { HomepageSection } from './entities/homepage/homepage-section.entity';
import { PageSettings } from './entities/setting/page-settings.entity';
import { SystemSetting } from './entities/setting/system-setting.entity';
import { AuthToken } from './entities/auth/auth-token.entity';
import { AuthProvider } from './entities/auth/auth-provider.entity';

@Injectable()
export class DatabaseService implements OnApplicationBootstrap {
  category: Repository<Category>;
  collection: Repository<Collection>;
  attribute: Repository<Attribute>;
  attributeValue: Repository<AttributeValue>;
  user: Repository<User>;
  userStatusChangeHistory: Repository<UserStatusChangeHistory>;
  adminUser: Repository<AdminUser>;
  address: Repository<Address>;
  country: Repository<Country>;
  division: Repository<Division>;
  district: Repository<District>;
  area: Repository<Area>;
  shippingZone: Repository<ShippingZone>;
  language: Repository<Language>;
  seller: Repository<Seller>;
  sellerStatusChangeHistory: Repository<SellerStatusChangeHistory>;
  sellerProductStatusChangeHistory: Repository<SellerProductStatusChangeHistory>;
  sellerPayout: Repository<SellerPayout>;
  shop: Repository<Shop>;
  sellerProduct: Repository<SellerProduct>;
  sellerProductSku: Repository<SellerProductSku>;
  sellerProductSkuVariant: Repository<SellerProductSkuVariant>;
  sellerProductSkuParent: Repository<SellerProductSkuParent>;
  productQuestion: Repository<ProductQuestion>;
  stockMovement: Repository<StockMovement>;
  paymentClaim: Repository<PaymentClaim>;
  orderRefund: Repository<OrderRefund>;
  orderRefundStatusHistory: Repository<OrderRefundStatusHistory>;
  sellerPaymentAccount: Repository<SellerPaymentAccount>;
  sellerDevice: Repository<SellerDevice>;
  userDevice: Repository<UserDevice>;
  sellerProductMedia: Repository<SellerProductMedia>;
  order: Repository<Order>;
  orderItem: Repository<OrderItem>;
  orderStatusHistory: Repository<OrderStatusHistory>;
  orderReturn: Repository<OrderReturn>;
  orderReturnItem: Repository<OrderReturnItem>;
  orderReturnStatusHistory: Repository<OrderReturnStatusHistory>;
  orderReturnAttachment: Repository<OrderReturnAttachment>;
  systemCommissionChangeHistory: Repository<SystemCommissionChangeHistory>;
  cart: Repository<Cart>;
  cartItem: Repository<CartItem>;
  coupon: Repository<Coupon>;
  couponHistoryLog: Repository<CouponHistoryLog>;
  review: Repository<Review>;
  wishlist: Repository<Wishlist>;
  payment: Repository<Payment>;
  paymentGateway: Repository<PaymentGateway>;
  paymentAttachment: Repository<PaymentAttachment>;
  paymentStatusHistory: Repository<PaymentStatusHistory>;
  orderUpdate: Repository<OrderUpdate>;
  orderUpdateAttachment: Repository<OrderUpdateAttachment>;
  banner: Repository<Banner>;
  homepageSection: Repository<HomepageSection>;
  pageSettings: Repository<PageSettings>;
  systemSetting: Repository<SystemSetting>;
  authToken: Repository<AuthToken>;
  authProvider: Repository<AuthProvider>;

  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Collection)
    private collectionRepository: Repository<Collection>,
    @InjectRepository(Attribute)
    private attributeRepository: Repository<Attribute>,
    @InjectRepository(AttributeValue)
    private attributeValueRepository: Repository<AttributeValue>,
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(UserStatusChangeHistory)
    private userStatusChangeHistoryRepository: Repository<UserStatusChangeHistory>,
    @InjectRepository(AdminUser)
    private adminUserRepository: Repository<AdminUser>,
    @InjectRepository(Address) private addressRepository: Repository<Address>,
    @InjectRepository(Country) private countryRepository: Repository<Country>,
    @InjectRepository(Division)
    private divisionRepository: Repository<Division>,
    @InjectRepository(District)
    private districtRepository: Repository<District>,
    @InjectRepository(Area) private areaRepository: Repository<Area>,
    @InjectRepository(ShippingZone)
    private shippingZoneRepository: Repository<ShippingZone>,
    @InjectRepository(Language)
    private languageRepository: Repository<Language>,
    @InjectRepository(Seller) private sellerRepository: Repository<Seller>,
    @InjectRepository(SellerProductStatusChangeHistory)
    private sellerProductStatusChangeHistoryRepository: Repository<SellerProductStatusChangeHistory>,
    @InjectRepository(SellerStatusChangeHistory)
    private sellerStatusChangeHistoryRepository: Repository<SellerStatusChangeHistory>,
    @InjectRepository(SellerPayout)
    private sellerPayoutRepository: Repository<SellerPayout>,
    @InjectRepository(Shop) private shopRepository: Repository<Shop>,
    @InjectRepository(SellerProduct)
    private sellerProductRepository: Repository<SellerProduct>,
    @InjectRepository(SellerProductSku)
    private sellerProductSkuRepository: Repository<SellerProductSku>,
    @InjectRepository(SellerProductSkuVariant)
    private sellerProductSkuVariantRepository: Repository<SellerProductSkuVariant>,
    @InjectRepository(SellerProductSkuParent)
    private sellerProductSkuParentRepository: Repository<SellerProductSkuParent>,
    @InjectRepository(ProductQuestion) private productQuestionRepository: Repository<ProductQuestion>,
    @InjectRepository(StockMovement) private stockMovementRepository: Repository<StockMovement>,
    @InjectRepository(PaymentClaim) private paymentClaimRepository: Repository<PaymentClaim>,
    @InjectRepository(OrderRefund) private orderRefundRepository: Repository<OrderRefund>,
    @InjectRepository(OrderRefundStatusHistory) private orderRefundStatusHistoryRepository: Repository<OrderRefundStatusHistory>,
    @InjectRepository(SellerPaymentAccount) private sellerPaymentAccountRepository: Repository<SellerPaymentAccount>,
    @InjectRepository(SellerDevice) private sellerDeviceRepository: Repository<SellerDevice>,
    @InjectRepository(UserDevice) private userDeviceRepository: Repository<UserDevice>,
    @InjectRepository(SellerProductMedia)
    private sellerProductMediaRepository: Repository<SellerProductMedia>,
    @InjectRepository(Order) private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(OrderStatusHistory)
    private orderStatusHistoryRepository: Repository<OrderStatusHistory>,
    @InjectRepository(OrderReturn)
    private orderReturnRepository: Repository<OrderReturn>,
    @InjectRepository(OrderReturnItem)
    private orderReturnItemRepository: Repository<OrderReturnItem>,
    @InjectRepository(OrderReturnStatusHistory)
    private orderReturnStatusHistoryRepository: Repository<OrderReturnStatusHistory>,
    @InjectRepository(OrderReturnAttachment)
    private orderReturnAttachmentRepository: Repository<OrderReturnAttachment>,
    @InjectRepository(SystemCommissionChangeHistory)
    private systemCommissionChangeHistoryRepository: Repository<SystemCommissionChangeHistory>,
    @InjectRepository(Cart) private cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private cartItemRepository: Repository<CartItem>,
    @InjectRepository(Coupon) private couponRepository: Repository<Coupon>,
    @InjectRepository(CouponHistoryLog)
    private couponHistoryLogRepository: Repository<CouponHistoryLog>,
    @InjectRepository(Review) private reviewRepository: Repository<Review>,
    @InjectRepository(Wishlist)
    private wishlistRepository: Repository<Wishlist>,
    @InjectRepository(Payment) private paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentGateway)
    private paymentGatewayRepository: Repository<PaymentGateway>,
    @InjectRepository(PaymentAttachment)
    private paymentAttachmentRepository: Repository<PaymentAttachment>,
    @InjectRepository(PaymentStatusHistory)
    private paymentStatusHistoryRepository: Repository<PaymentStatusHistory>,
    @InjectRepository(OrderUpdate)
    private orderUpdateRepository: Repository<OrderUpdate>,
    @InjectRepository(OrderUpdateAttachment)
    private orderUpdateAttachmentRepository: Repository<OrderUpdateAttachment>,
    @InjectRepository(Banner) private bannerRepository: Repository<Banner>,
    @InjectRepository(HomepageSection)
    private homepageSectionRepository: Repository<HomepageSection>,
    @InjectRepository(PageSettings)
    private pageSettingsRepository: Repository<PageSettings>,
    @InjectRepository(SystemSetting)
    private systemSettingRepository: Repository<SystemSetting>,
    @InjectRepository(AuthToken)
    private authTokenRepository: Repository<AuthToken>,
    @InjectRepository(AuthProvider)
    private authProviderRepository: Repository<AuthProvider>,
  ) {}

  onApplicationBootstrap() {
    this.category = this.categoryRepository;
    this.collection = this.collectionRepository;
    this.attribute = this.attributeRepository;
    this.attributeValue = this.attributeValueRepository;
    this.user = this.userRepository;
    this.userStatusChangeHistory = this.userStatusChangeHistoryRepository;
    this.adminUser = this.adminUserRepository;
    this.address = this.addressRepository;
    this.country = this.countryRepository;
    this.division = this.divisionRepository;
    this.district = this.districtRepository;
    this.area = this.areaRepository;
    this.shippingZone = this.shippingZoneRepository;
    this.language = this.languageRepository;
    this.seller = this.sellerRepository;
    this.sellerStatusChangeHistory = this.sellerStatusChangeHistoryRepository;
    this.sellerProductStatusChangeHistory =
      this.sellerProductStatusChangeHistoryRepository;
    this.sellerPayout = this.sellerPayoutRepository;
    this.shop = this.shopRepository;
    this.sellerProduct = this.sellerProductRepository;
    this.sellerProductSku = this.sellerProductSkuRepository;
    this.sellerProductSkuVariant = this.sellerProductSkuVariantRepository;
    this.sellerProductSkuParent = this.sellerProductSkuParentRepository;
    this.productQuestion = this.productQuestionRepository;
    this.stockMovement = this.stockMovementRepository;
    this.paymentClaim = this.paymentClaimRepository;
    this.orderRefund = this.orderRefundRepository;
    this.orderRefundStatusHistory = this.orderRefundStatusHistoryRepository;
    this.sellerPaymentAccount = this.sellerPaymentAccountRepository;
    this.sellerDevice = this.sellerDeviceRepository;
    this.userDevice = this.userDeviceRepository;
    this.sellerProductMedia = this.sellerProductMediaRepository;
    this.order = this.orderRepository;
    this.orderItem = this.orderItemRepository;
    this.orderStatusHistory = this.orderStatusHistoryRepository;
    this.orderReturn = this.orderReturnRepository;
    this.orderReturnItem = this.orderReturnItemRepository;
    this.orderReturnStatusHistory = this.orderReturnStatusHistoryRepository;
    this.orderReturnAttachment = this.orderReturnAttachmentRepository;
    this.systemCommissionChangeHistory = this.systemCommissionChangeHistoryRepository;
    this.cart = this.cartRepository;
    this.cartItem = this.cartItemRepository;
    this.coupon = this.couponRepository;
    this.couponHistoryLog = this.couponHistoryLogRepository;
    this.review = this.reviewRepository;
    this.wishlist = this.wishlistRepository;
    this.payment = this.paymentRepository;
    this.paymentGateway = this.paymentGatewayRepository;
    this.paymentAttachment = this.paymentAttachmentRepository;
    this.paymentStatusHistory = this.paymentStatusHistoryRepository;
    this.orderUpdate = this.orderUpdateRepository;
    this.orderUpdateAttachment = this.orderUpdateAttachmentRepository;
    this.banner = this.bannerRepository;
    this.homepageSection = this.homepageSectionRepository;
    this.pageSettings = this.pageSettingsRepository;
    this.systemSetting = this.systemSettingRepository;
    this.authToken = this.authTokenRepository;
    this.authProvider = this.authProviderRepository;
  }
}
