import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/account/ui/change_password_screen.dart';
import '../../features/account/ui/checklist_screen.dart';
import '../../features/account/ui/profile_screen.dart';
import '../../features/account/ui/register_screen.dart';
import '../../features/account/ui/selling_screen.dart';
import '../../features/auth/ui/login_screen.dart';
import '../../features/orders/data/order_models.dart';
import '../../features/products/ui/product_detail_screen.dart';
import '../../features/products/ui/product_form_screen.dart';
import '../../features/products/ui/product_pictures_screen.dart';
import '../../features/orders/ui/create_order_screen.dart';
import '../../features/orders/ui/order_detail_screen.dart';
import '../../features/orders/ui/post_update_screen.dart';
import '../../features/orders/ui/record_payment_screen.dart';
import '../../features/home/ui/home_shell.dart';
import '../../shared/widgets/placeholder_page.dart';
import '../auth/auth_controller.dart';

/// Every "More" entry that has no screen yet opens the same placeholder,
/// keyed by its route so the title/icon match what the menu showed.
const _morePlaceholders = <String, (String, IconData)>{
  '/more/payments': ('Payments', Icons.payments_outlined),
  '/more/payment-claims': ('Paid requests', Icons.fact_check_outlined),
  '/more/payment-accounts': ('Payment accounts', Icons.account_balance_outlined),
  '/more/returns': ('Returns', Icons.assignment_return_outlined),
  '/more/refunds': ('Refunds', Icons.currency_exchange),
  '/more/commission': ('System commission', Icons.percent),
  '/more/statements': ('Statements', Icons.receipt_long_outlined),
  '/more/reports': ('Reports', Icons.bar_chart_outlined),
  '/more/offers': ('Price offers', Icons.local_offer_outlined),
  '/more/questions': ('Questions', Icons.help_outline),
  '/more/reviews': ('Reviews', Icons.star_outline),
  '/more/wishlist': ('Wishlist insights', Icons.favorite_border),
  '/more/help': ('Help topics', Icons.menu_book_outlined),
};

final routerProvider = Provider<GoRouter>((ref) {
  // Tell the router to re-check its redirect whenever the sign-in state changes.
  final refresh = ValueNotifier<int>(0);
  ref.listen(authProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      final status = ref.read(authProvider).status;
      final atLogin = state.matchedLocation == '/login';
      final atOpen = atLogin || state.matchedLocation == '/register';
      if (status == AuthStatus.unknown) return null;
      if (status == AuthStatus.signedOut) return atOpen ? null : '/login';
      return atOpen ? '/' : null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, _) => const RegisterScreen()),
      GoRoute(
        path: '/',
        builder: (_, _) => const HomeShell(),
        routes: [
          // 'new' must stay above ':id' so it is not read as an order id.
          GoRoute(path: 'orders/new', builder: (_, _) => const CreateOrderScreen()),
          GoRoute(
            path: 'orders/:id',
            builder: (_, state) => OrderDetailScreen(orderId: int.parse(state.pathParameters['id']!)),
            routes: [
              GoRoute(path: 'pay', builder: (_, state) => RecordPaymentScreen(order: state.extra! as OrderDetail)),
              GoRoute(path: 'update', builder: (_, state) => PostUpdateScreen(orderId: int.parse(state.pathParameters['id']!))),
            ],
          ),
          // 'new' must stay above ':id' so it is not read as a product id.
          GoRoute(path: 'products/new', builder: (_, _) => const ProductFormScreen()),
          GoRoute(
            path: 'products/:id',
            builder: (_, state) => ProductDetailScreen(productId: int.parse(state.pathParameters['id']!)),
            routes: [
              GoRoute(path: 'edit', builder: (_, state) => ProductFormScreen(productId: int.parse(state.pathParameters['id']!))),
              GoRoute(path: 'pictures', builder: (_, state) => ProductPicturesScreen(productId: int.parse(state.pathParameters['id']!))),
            ],
          ),
          GoRoute(path: 'more/profile', builder: (_, _) => const ProfileScreen()),
          GoRoute(path: 'more/selling', builder: (_, _) => const SellingScreen()),
          GoRoute(path: 'more/password', builder: (_, _) => const ChangePasswordScreen()),
          GoRoute(path: 'more/checklist', builder: (_, _) => const ChecklistScreen()),
          for (final MapEntry(key: path, value: (title, icon)) in _morePlaceholders.entries)
            GoRoute(path: path.substring(1), builder: (_, _) => PlaceholderPage(title: title, icon: icon)),
        ],
      ),
    ],
    errorBuilder: (_, _) => const Scaffold(body: Center(child: Text('Page not found'))),
  );
});
