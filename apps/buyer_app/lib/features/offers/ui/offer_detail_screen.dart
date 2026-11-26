import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/format/money.dart';
import '../../../shared/format/text.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/proposal_api.dart';
import '../data/proposal_models.dart';

final offerDetailProvider = FutureProvider.family<ProposalDetail, int>((ref, id) => ref.read(proposalApiProvider).get(id));

class OfferDetailScreen extends ConsumerWidget {
  const OfferDetailScreen({super.key, required this.id});
  final int id;

  Future<void> _act(BuildContext context, WidgetRef ref, String action, ProposalDetail p) async {
    if (action == 'counter') {
      final result = await showDialog<Map<String, String>>(
        context: context,
        builder: (dialogContext) {
          final price = TextEditingController(text: p.price.toStringAsFixed(2));
          final qty = TextEditingController(text: '${p.quantity}');
          return AlertDialog(
            title: const Text('Counter offer'),
            content: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(controller: price, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Your price per unit')),
              TextField(controller: qty, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantity')),
            ]),
            actions: [
              TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cancel')),
              FilledButton(onPressed: () => Navigator.pop(dialogContext, {'price': price.text, 'quantity': qty.text}), child: const Text('Send')),
            ],
          );
        },
      );
      if (result == null) return;
      await ref.read(proposalApiProvider).counter(p.id, price: num.parse(result['price']!), quantity: int.tryParse(result['quantity'] ?? ''));
      ref.invalidate(offerDetailProvider(p.id));
      return;
    }

    final confirmLabel = switch (action) {
      'accept' => 'Accept this offer?',
      'reject' => 'Reject this offer?',
      _ => 'Cancel this offer?',
    };
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(confirmLabel),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('No')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Yes')),
        ],
      ),
    );
    if (confirmed != true) return;
    final api = ref.read(proposalApiProvider);
    switch (action) {
      case 'accept':
        await api.accept(p.id);
      case 'reject':
        await api.reject(p.id);
      case 'cancel':
        await api.cancel(p.id);
    }
    ref.invalidate(offerDetailProvider(p.id));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(offerDetailProvider(id));
    return Scaffold(
      appBar: AppBar(title: const Text('Offer')),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: 'Could not load this offer.', onRetry: () => ref.invalidate(offerDetailProvider(id))),
        data: (p) => ListView(
          padding: const EdgeInsets.all(AppSpacing.m),
          children: [
            Row(children: [Expanded(child: Text(p.productName, style: Theme.of(context).textTheme.titleLarge)), StatusBadge(label: statusLabel(p.status), tone: p.status == 'accepted' || p.status == 'used' ? StatusTone.success : (p.status == 'rejected' || p.status == 'cancelled' ? StatusTone.danger : StatusTone.warning))]),
            if (p.skuLabel != null) Text(p.skuLabel!, style: const TextStyle(color: AppTheme.slate)),
            Text('With ${p.sellerName}', style: const TextStyle(color: AppTheme.slate)),
            const Divider(height: AppSpacing.l),
            _row('Your offer', '${p.quantity} × ${formatUsd(p.price)} = ${formatUsd(p.total)}'),
            _row('Current SKU price', formatUsd(p.skuPriceNow)),
            if (p.awaitingParty != null) _row('Waiting on', p.awaitingMe ? 'You' : p.sellerName),
            const SizedBox(height: AppSpacing.l),
            if (p.history.isNotEmpty) ...[
              Text('History', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppSpacing.xs),
              for (final h in p.history)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text('${statusLabel(h.action)} by ${h.actorName ?? 'system'} — ${h.quantity} × ${formatUsd(h.price)} · ${formatDateTime(h.createdAt)}${h.note != null ? '\n"${h.note}"' : ''}', style: const TextStyle(fontSize: 12, color: AppTheme.slate)),
                ),
            ],
            const SizedBox(height: AppSpacing.l),
            Wrap(
              spacing: AppSpacing.s,
              children: [
                for (final action in p.actions)
                  action == 'accept'
                      ? FilledButton(onPressed: () => _act(context, ref, action, p), child: const Text('Accept'))
                      : OutlinedButton(onPressed: () => _act(context, ref, action, p), child: Text(statusLabel(action))),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label, style: const TextStyle(color: AppTheme.slate)), Text(value, style: const TextStyle(fontWeight: FontWeight.w600))]),
      );
}
