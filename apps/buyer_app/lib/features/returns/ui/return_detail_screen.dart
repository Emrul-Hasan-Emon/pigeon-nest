import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/format/money.dart';
import '../../../shared/format/text.dart';
import '../../../shared/widgets/catalogue_plate.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/return_api.dart';
import '../data/return_models.dart';

final returnDetailProvider = FutureProvider.family<ReturnDetail, int>((ref, id) => ref.read(returnApiProvider).get(id));

StatusTone _tone(String status) => switch (status) {
      'returned' || 'accepted' => StatusTone.success,
      'rejected' || 'cancelled' => StatusTone.danger,
      'returning_money' || 'processing' => StatusTone.info,
      _ => StatusTone.warning,
    };

class ReturnDetailScreen extends ConsumerWidget {
  const ReturnDetailScreen({super.key, required this.id});
  final int id;

  Future<void> _cancel(BuildContext context, WidgetRef ref, int returnId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cancel this return request?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Keep it')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Cancel return')),
        ],
      ),
    );
    if (confirmed != true) return;
    await ref.read(returnApiProvider).cancel(returnId);
    ref.invalidate(returnDetailProvider(returnId));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(returnDetailProvider(id));
    return Scaffold(
      appBar: AppBar(title: Text(async.asData?.value == null ? 'Return' : '#${async.asData!.value.returnNumber}')),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: 'Could not load this return.', onRetry: () => ref.invalidate(returnDetailProvider(id))),
        data: (r) => ListView(
          padding: const EdgeInsets.all(AppSpacing.m),
          children: [
            Row(children: [StatusBadge(label: statusLabel(r.status), tone: _tone(r.status)), const Spacer(), Text(formatDate(r.createdAt), style: const TextStyle(color: AppTheme.slate, fontSize: 12))]),
            const SizedBox(height: AppSpacing.s),
            Text('Order #${r.orderNumber ?? '—'}', style: const TextStyle(color: AppTheme.slate)),
            const Divider(height: AppSpacing.l),
            for (final item in r.items)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.s),
                child: Row(
                  children: [
                    SizedBox(width: 44, child: CataloguePlate(child: item.imageUrl != null ? Image.network(item.imageUrl!, fit: BoxFit.cover) : Container(color: AppTheme.dove))),
                    const SizedBox(width: AppSpacing.s),
                    Expanded(child: Text(item.productName)),
                    Text(formatUsd(item.refundAmount), style: const TextStyle(fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            const Divider(),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Refund total', style: TextStyle(fontWeight: FontWeight.w700)), Text(formatUsd(r.refundAmount), style: const TextStyle(fontWeight: FontWeight.w700))]),
            const SizedBox(height: AppSpacing.l),
            Text('Your reason', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: AppSpacing.xs),
            Text(r.reason),
            if (r.history.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.l),
              Text('Status history', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppSpacing.xs),
              for (final h in r.history)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [Text(statusLabel(h.status), style: const TextStyle(fontWeight: FontWeight.w600)), const SizedBox(width: AppSpacing.s), Text(formatDateTime(h.createdAt), style: const TextStyle(color: AppTheme.slate, fontSize: 12))]),
                    if (h.note != null) Text(h.note!, style: const TextStyle(fontSize: 12)),
                  ]),
                ),
            ],
            const SizedBox(height: AppSpacing.l),
            if (r.canCancel) OutlinedButton(onPressed: () => _cancel(context, ref, r.id), child: const Text('Cancel return request')),
          ],
        ),
      ),
    );
  }
}
