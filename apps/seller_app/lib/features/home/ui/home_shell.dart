import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../shared/widgets/placeholder_page.dart';

/// The signed-in frame: a bottom bar with the main seller sections.
/// Each tab is a placeholder until its feature is built under lib/features/.
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  int _index = 0;

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
      body: PlaceholderPage(title: tab.label, icon: tab.icon),
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
