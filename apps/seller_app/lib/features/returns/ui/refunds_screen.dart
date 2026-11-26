import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/format/money.dart';
import '../../../shared/format/text.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/paged_list.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/return_models.dart';
import '../data/returns_api.dart';

StatusTone refundTone(String s) => switch (s) {
      'refunded' => StatusTone.success,
      'needs_to_refund' => StatusTone.danger,
      'processing' => StatusTone.warning,
      _ => StatusTone.neutral,
    };

/// Cancelled orders that had money paid, and the steps to send it back.
class RefundsScreen extends ConsumerStatefulWidget {
  const RefundsScreen({super.key});

  @override
  ConsumerState<RefundsScreen> createState() => _RefundsScreenState();
}

class _RefundsScreenState extends ConsumerState<RefundsScreen> {
  String? _status = 'needs_to_refund';
  int _version = 0;

  @override
  Widget build(BuildContext context) {
    final counts = ref.watch(refundSummaryProvider).value ?? const <String, int>{};
    String withCount(String label, String key) => counts[key] == null ? label : '$label (${counts[key]})';
    return Scaffold(
      appBar: AppBar(title: const Text('Refunds')),
      body: Column(children: [
        SizedBox(
          height: 52,
          child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.all(AppSpacing.s), children: [
            for (final (label, value) in [
              (withCount('To send', 'needsToRefund'), 'needs_to_refund'),
              (withCount('Processing', 'processing'), 'processing'),
              (withCount('Refunded', 'refunded'), 'refunded'),
              ('All', null),
            ])
              Padding(padding: const EdgeInsets.only(right: AppSpacing.s), child: ChoiceChip(label: Text(label), selected: _status == value, onSelected: (_) => setState(() => _status = value))),
          ]),
        ),
        Expanded(
          child: PagedList<RefundRecord>(
            fetch: ref.read(returnsApiProvider).refundsFetcher(status: _status),
            reloadKey: '$_status|$_version',
            emptyText: 'No refunds here.',
            emptyIcon: Icons.currency_exchange,
            itemBuilder: (context, r) => AppCard(
              onTap: () async {
                await context.push('/more/refunds/${r.id}');
                ref.invalidate(refundSummaryProvider);
                if (mounted) setState(() => _version++);
              },
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(r.orderNumber ?? 'Order', style: const TextStyle(fontWeight: FontWeight.w700)),
                    if (r.customerName != null) Text(r.customerName!, style: const TextStyle(color: AppTheme.neutral)),
                    Text(formatDate(r.createdAt), style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
                    const SizedBox(height: AppSpacing.xs),
                    StatusBadge(label: statusLabel(r.status), tone: refundTone(r.status)),
                  ]),
                ),
                Text(formatUsd(r.amount ?? r.expectedAmount), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}
