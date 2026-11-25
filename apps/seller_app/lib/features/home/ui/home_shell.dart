import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/auth/seller_access.dart';
import '../../../shared/widgets/access_banner.dart';
import '../../account/ui/checklist_screen.dart';
import '../../dashboard/ui/dashboard_screen.dart';
import '../../more/ui/more_menu_screen.dart';
import '../../orders/ui/orders_screen.dart';
import '../../products/ui/products_screen.dart';

/// The signed-in frame: a bottom bar with the main seller sections.
/// Each tab is a placeholder until its feature is built under lib/features/.
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key, this.initialTab = 0});
  final int initialTab;

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  late int _index = widget.initialTab.clamp(0, 3);

  static const _tabs = [
    (label: 'Home', icon: Icons.home_outlined, active: Icons.home),
    (label: 'Orders', icon: Icons.receipt_long_outlined, active: Icons.receipt_long),
    (label: 'Products', icon: Icons.inventory_2_outlined, active: Icons.inventory_2),
    (label: 'More', icon: Icons.menu, active: Icons.menu_open),
  ];

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final tab = _tabs[_index];
    return Scaffold(
      appBar: AppBar(
        title: Text(_index == 0 ? (auth.shopName ?? 'My shop') : tab.label),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authProvider.notifier).signOut(),
          ),
        ],
      ),
      body: switch (_index) {
        0 => _HomeTab(access: auth.access),
        1 => const OrdersScreen(),
        2 => const ProductsScreen(),
        3 => const MoreMenuScreen(),
        _ => const SizedBox.shrink(),
      },
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          for (final t in _tabs) NavigationDestination(icon: Icon(t.icon), selectedIcon: Icon(t.active), label: t.label),
        ],
      ),
    );
  }
}

/// The Home tab's own body: the access banner (hidden once the seller can
/// fully manage their shop) above the dashboard placeholder.
class _HomeTab extends StatelessWidget {
  const _HomeTab({required this.access});

  final SellerAccess? access;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (access != null) AccessBanner(access: access!),
        const ChecklistCard(),
        // Dashboard figures are for approved, active sellers only.
        if (access?.canManage ?? true) const Expanded(child: DashboardScreen()) else const Spacer(),
      ],
    );
  }
}
