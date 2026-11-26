import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/app_theme.dart';
import '../../account/ui/profile_screen.dart';
import '../../cart/ui/cart_screen.dart';
import '../../catalog/ui/categories_screen.dart';
import '../../orders/ui/orders_screen.dart';
import 'homepage_screen.dart';

/// The app's frame: a bottom bar with the main buyer sections. Browsing
/// (Home, Categories) works the same whether signed in or not; Cart, Orders
/// and Account each decide for themselves whether to ask for a sign-in.
/// Each tab is a placeholder until its feature is built under lib/features/.
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key, this.initialTab = 0});
  final int initialTab;

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  late int _index = widget.initialTab.clamp(0, 4);

  static const _tabs = [
    (label: 'Home', icon: Icons.storefront_outlined, active: Icons.storefront),
    (label: 'Categories', icon: Icons.grid_view_outlined, active: Icons.grid_view),
    (label: 'Cart', icon: Icons.shopping_bag_outlined, active: Icons.shopping_bag),
    (label: 'Orders', icon: Icons.receipt_long_outlined, active: Icons.receipt_long),
    (label: 'Account', icon: Icons.person_outline, active: Icons.person),
  ];

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final tab = _tabs[_index];
    // The account tab, once signed in, is the full profile screen — it
    // supplies its own app bar (title + sign-out), so the shell's is hidden.
    final signedIn = auth.status == AuthStatus.signedIn;
    final hideAppBar = _index == 4 && signedIn;
    return Scaffold(
      appBar: hideAppBar
          ? null
          : AppBar(
              title: _index == 0
                  ? Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('Pigeon Nest'),
                        const SizedBox(width: 6),
                        Container(width: 5, height: 5, decoration: const BoxDecoration(color: AppTheme.brass, shape: BoxShape.circle)),
                      ],
                    )
                  : Text(tab.label),
              actions: switch (_index) {
                0 => [
                    IconButton(icon: const Icon(Icons.search), tooltip: 'Browse all birds', onPressed: () => context.push('/products')),
                    IconButton(icon: const Icon(Icons.storefront_outlined), tooltip: 'Sellers', onPressed: () => context.push('/sellers')),
                  ],
                3 => [IconButton(icon: const Icon(Icons.local_shipping_outlined), tooltip: 'Track an order', onPressed: () => context.push('/orders/track'))],
                _ => null,
              },
            ),
      body: switch (_index) {
        0 => const HomepageScreen(),
        1 => const CategoriesScreen(),
        2 => const CartScreen(),
        3 => _OrdersOrSignIn(signedIn: signedIn),
        4 => signedIn ? const ProfileScreen() : const _SignInPrompt(message: 'Sign in to see your profile, addresses and offers.'),
        _ => const SizedBox.shrink(),
      },
      bottomNavigationBar: DecoratedBox(
        decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppTheme.line))),
        child: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: (i) => setState(() => _index = i),
          destinations: [
            for (final t in _tabs) NavigationDestination(icon: Icon(t.icon), selectedIcon: Icon(t.active), label: t.label),
          ],
        ),
      ),
    );
  }
}

class _OrdersOrSignIn extends StatelessWidget {
  const _OrdersOrSignIn({required this.signedIn});
  final bool signedIn;

  @override
  Widget build(BuildContext context) {
    if (!signedIn) return const _SignInPrompt(message: 'Sign in to see your orders, or track one by its number.', trackLink: true);
    return const OrdersScreen();
  }
}

class _SignInPrompt extends ConsumerWidget {
  const _SignInPrompt({required this.message, this.trackLink = false});
  final String message;
  final bool trackLink;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: () => context.push('/login'), child: const Text('Sign in')),
            if (trackLink) ...[
              const SizedBox(height: 8),
              TextButton(onPressed: () => context.push('/orders/track'), child: const Text('Track an order')),
            ],
          ],
        ),
      ),
    );
  }
}
