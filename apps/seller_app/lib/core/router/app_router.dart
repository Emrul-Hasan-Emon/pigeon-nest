import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/account/ui/change_password_screen.dart';
import '../../features/account/ui/checklist_screen.dart';
import '../../features/account/ui/profile_screen.dart';
import '../../features/account/ui/register_screen.dart';
import '../../features/account/ui/selling_screen.dart';
import '../../features/auth/ui/login_screen.dart';
import '../../features/commission/ui/commission_screen.dart';
import '../../features/commission/ui/disbursement_screen.dart';
import '../../features/payments/ui/accounts_screen.dart';
import '../../features/payments/ui/claims_screen.dart';
import '../../features/payments/ui/payment_detail_screen.dart';
import '../../features/payments/ui/payments_screen.dart';
import '../../features/reports/ui/reports_screen.dart';
import '../../features/reports/ui/statements_screen.dart';
import '../../features/returns/ui/refund_detail_screen.dart';
import '../../features/returns/ui/refunds_screen.dart';
import '../../features/returns/ui/return_detail_screen.dart';
import '../../features/returns/ui/returns_screen.dart';
import '../../features/offers/ui/offer_detail_screen.dart';
import '../../features/offers/ui/offers_screen.dart';
import '../../features/orders/data/order_models.dart';
import '../../features/questions/ui/questions_screen.dart';
import '../../features/reviews/data/review_models.dart';
import '../../features/reviews/ui/review_thread_screen.dart';
import '../../features/reviews/ui/reviews_screen.dart';
import '../../features/wishlist/ui/wishlist_screen.dart';
import '../../features/products/ui/product_detail_screen.dart';
import '../../features/products/ui/product_form_screen.dart';
import '../../features/products/ui/product_pictures_screen.dart';
import '../../features/orders/ui/create_order_screen.dart';
import '../../features/orders/ui/order_detail_screen.dart';
import '../../features/orders/ui/post_update_screen.dart';
import '../../features/orders/ui/record_payment_screen.dart';
import '../../features/help/ui/help_topic_screen.dart';
import '../../features/help/ui/help_topics_screen.dart';
import '../../features/home/ui/home_shell.dart';
import '../auth/auth_controller.dart';

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
        builder: (_, state) {
          final tab = int.tryParse(state.uri.queryParameters['tab'] ?? '') ?? 0;
          return HomeShell(key: ValueKey(tab), initialTab: tab);
        },
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
          GoRoute(path: 'more/payments', builder: (_, _) => const PaymentsScreen(), routes: [
            GoRoute(path: ':id', builder: (_, state) => PaymentDetailScreen(paymentId: int.parse(state.pathParameters['id']!))),
          ]),
          GoRoute(path: 'more/payment-claims', builder: (_, _) => const ClaimsScreen()),
          GoRoute(path: 'more/payment-accounts', builder: (_, _) => const AccountsScreen()),
          GoRoute(path: 'more/returns', builder: (_, _) => const ReturnsScreen(), routes: [
            GoRoute(path: ':id', builder: (_, state) => ReturnDetailScreen(returnId: int.parse(state.pathParameters['id']!))),
          ]),
          GoRoute(path: 'more/refunds', builder: (_, _) => const RefundsScreen(), routes: [
            GoRoute(path: ':id', builder: (_, state) => RefundDetailScreen(refundId: int.parse(state.pathParameters['id']!))),
          ]),
          GoRoute(path: 'more/commission', builder: (_, _) => const CommissionScreen(), routes: [
            GoRoute(path: 'payments/:id', builder: (_, state) => DisbursementScreen(id: int.parse(state.pathParameters['id']!))),
          ]),
          GoRoute(path: 'more/statements', builder: (_, _) => const StatementsScreen()),
          GoRoute(path: 'more/reports', builder: (_, _) => const ReportsScreen()),
          GoRoute(path: 'more/offers', builder: (_, _) => const OffersScreen(), routes: [
            GoRoute(path: ':id', builder: (_, state) => OfferDetailScreen(offerId: int.parse(state.pathParameters['id']!))),
          ]),
          GoRoute(path: 'more/questions', builder: (_, _) => const QuestionsScreen()),
          GoRoute(path: 'more/reviews', builder: (_, _) => const ReviewsScreen(), routes: [
            GoRoute(path: ':id', builder: (_, state) => ReviewThreadScreen(review: state.extra! as Review)),
          ]),
          GoRoute(path: 'more/wishlist', builder: (_, _) => const WishlistScreen()),
          GoRoute(path: 'more/help', builder: (_, _) => const HelpTopicsScreen(), routes: [
            GoRoute(path: ':slug', builder: (_, state) => HelpTopicScreen(slug: state.pathParameters['slug']!)),
          ]),
          GoRoute(path: 'more/profile', builder: (_, _) => const ProfileScreen()),
          GoRoute(path: 'more/selling', builder: (_, _) => const SellingScreen()),
          GoRoute(path: 'more/password', builder: (_, _) => const ChangePasswordScreen()),
          GoRoute(path: 'more/checklist', builder: (_, _) => const ChecklistScreen()),
        ],
      ),
    ],
    errorBuilder: (_, _) => const Scaffold(body: Center(child: Text('Page not found'))),
  );
});
