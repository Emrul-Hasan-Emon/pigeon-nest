import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../data/address_model.dart';
import '../state/addresses_controller.dart';
import 'address_form_screen.dart';

/// Your saved addresses. The first one is the default; checkout will offer
/// the default pre-filled and the others to pick from (phase 3).
class AddressesScreen extends ConsumerWidget {
  const AddressesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(addressesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Your addresses')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AddressFormScreen())),
        icon: const Icon(Icons.add),
        label: const Text('Add an address'),
      ),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: e.toString(), onRetry: () => ref.read(addressesProvider.notifier).reload()),
        data: (addresses) {
          if (addresses.isEmpty) {
            return const EmptyView(message: 'No saved addresses yet.', icon: Icons.location_on_outlined);
          }
          return ListView.separated(
            padding: const EdgeInsets.all(AppSpacing.m),
            itemCount: addresses.length,
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.s),
            itemBuilder: (_, i) => _AddressCard(address: addresses[i]),
          );
        },
      ),
    );
  }
}

class _AddressCard extends ConsumerWidget {
  const _AddressCard({required this.address});
  final AddressView address;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.m),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(address.recipientName, style: const TextStyle(fontWeight: FontWeight.w700))),
                if (address.isDefault)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s, vertical: 2),
                    decoration: BoxDecoration(color: AppTheme.teal.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
                    child: const Text('Default', style: TextStyle(color: AppTheme.teal, fontSize: 12, fontWeight: FontWeight.w600)),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(address.phone, style: const TextStyle(color: AppTheme.slate)),
            const SizedBox(height: 4),
            Text(
              [address.address, address.city, address.state, address.countryName, address.zipCode].whereType<String>().where((s) => s.isNotEmpty).join(', '),
              style: const TextStyle(color: AppTheme.slate),
            ),
            const SizedBox(height: AppSpacing.s),
            Row(
              children: [
                TextButton(
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => AddressFormScreen(existing: address))),
                  child: const Text('Edit'),
                ),
                TextButton(
                  onPressed: () async {
                    final confirmed = await showDialog<bool>(
                      context: context,
                      builder: (_) => AlertDialog(
                        title: const Text('Delete this address?'),
                        actions: [
                          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
                          TextButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Delete')),
                        ],
                      ),
                    );
                    if (confirmed == true) await ref.read(addressesProvider.notifier).remove(address.id);
                  },
                  child: Text('Delete', style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
