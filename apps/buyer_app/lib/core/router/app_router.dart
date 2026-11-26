import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/addresses/ui/addresses_screen.dart';
import '../../features/auth/ui/login_screen.dart';
import '../../features/auth/ui/register_screen.dart';
import '../../features/catalog/data/storefront_models.dart';
import '../../features/catalog/ui/category_detail_screen.dart';
import '../../features/catalog/ui/collection_detail_screen.dart';
import '../../features/catalog/ui/collections_screen.dart';
import '../../features/catalog/ui/product_list_screen.dart';
import '../../features/checkout/ui/checkout_screen.dart';
import '../../features/home/ui/home_shell.dart';
import '../../features/offers/ui/offer_detail_screen.dart';
import '../../features/offers/ui/offers_screen.dart';
import '../../features/orders/ui/order_detail_screen.dart';
import '../../features/orders/ui/track_order_screen.dart';
import '../../features/product_detail/ui/product_detail_screen.dart';
import '../../features/returns/ui/request_return_screen.dart';
import '../../features/returns/ui/return_detail_screen.dart';
import '../../features/returns/ui/returns_screen.dart';
import '../../features/reviews/ui/my_reviews_screen.dart';
import '../../features/sellers/ui/seller_detail_screen.dart';
import '../../features/sellers/ui/sellers_screen.dart';
import '../../features/wishlist/ui/wishlist_screen.dart';
import '../auth/auth_controller.dart';

/// Unlike the seller app, there is no blanket "signed out -> /login"
/// redirect: browsing stays open to guests. Screens that genuinely need a
/// sign-in (checkout, orders, wishlist, account) ask for one themselves and
/// send the buyer back to '/login', which returns to '/' on success.
final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.listen(authProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    routes: [
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, _) => const RegisterScreen()),
      GoRoute(path: '/addresses', builder: (_, _) => const AddressesScreen()),
      GoRoute(path: '/categories/:slug', builder: (_, state) => CategoryDetailScreen(slug: state.pathParameters['slug']!)),
      GoRoute(path: '/collections', builder: (_, _) => const CollectionsScreen()),
      GoRoute(path: '/collections/:slug', builder: (_, state) => CollectionDetailScreen(slug: state.pathParameters['slug']!)),
      GoRoute(
        path: '/products',
        builder: (_, state) {
          final featured = state.uri.queryParameters['featured'] == 'true';
          return ProductListScreen(query: ProductQuery(featured: featured ? true : null), showFilters: true, title: 'Birds');
        },
      ),
      GoRoute(path: '/products/:id', builder: (_, state) => ProductDetailScreen(id: int.parse(state.pathParameters['id']!))),
      GoRoute(path: '/sellers', builder: (_, _) => const SellersScreen()),
      GoRoute(path: '/sellers/:id', builder: (_, state) => SellerDetailScreen(id: int.parse(state.pathParameters['id']!))),
      GoRoute(path: '/checkout/:cartId', builder: (_, state) => CheckoutScreen(cartId: int.parse(state.pathParameters['cartId']!))),
      GoRoute(path: '/orders/track', builder: (_, _) => const TrackOrderScreen()),
      GoRoute(
        path: '/orders/:id',
        builder: (_, state) => OrderDetailScreen(id: int.parse(state.pathParameters['id']!), justPlaced: state.uri.queryParameters['placed'] == 'true'),
      ),
      GoRoute(path: '/wishlist', builder: (_, _) => const WishlistScreen()),
      GoRoute(path: '/offers', builder: (_, _) => const OffersScreen()),
      GoRoute(path: '/offers/:id', builder: (_, state) => OfferDetailScreen(id: int.parse(state.pathParameters['id']!))),
      GoRoute(path: '/reviews', builder: (_, _) => const MyReviewsScreen()),
      GoRoute(path: '/returns', builder: (_, _) => const ReturnsScreen()),
      GoRoute(path: '/returns/request/:orderId', builder: (_, state) => RequestReturnScreen(orderId: int.parse(state.pathParameters['orderId']!))),
      GoRoute(path: '/returns/:id', builder: (_, state) => ReturnDetailScreen(id: int.parse(state.pathParameters['id']!))),
      GoRoute(
        path: '/',
        builder: (_, state) {
          final tab = int.tryParse(state.uri.queryParameters['tab'] ?? '') ?? 0;
          return HomeShell(key: ValueKey(tab), initialTab: tab);
        },
      ),
    ],
    errorBuilder: (_, _) => const Scaffold(body: Center(child: Text('Page not found'))),
  );
});
