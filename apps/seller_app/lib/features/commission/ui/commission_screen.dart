import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/format/money.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/cursor_list.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/key_value.dart';
import '../../../shared/widgets/loading_view.dart';
import '../data/commission_api.dart';
import '../data/commission_models.dart';

/// What the seller owes the marketplace: balance, how it was charged, payments made, and rate changes.
class CommissionScreen extends ConsumerWidget {
  const CommissionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final api = ref.read(commissionApiProvider);
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('System commission'),
          bottom: const TabBar(isScrollable: true, tabs: [Tab(text: 'Balance'), Tab(text: 'Charges'), Tab(text: 'Payments'), Tab(text: 'Rate changes')]),
        ),
        body: TabBarView(children: [
          const _Balance(),
          CursorList<CommissionLine>(
            fetch: api.historyFetcher(),
            emptyText: 'No charges yet.',
            emptyIcon: Icons.percent,
            itemBuilder: (_, l) => AppCard(
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(l.title, style: TextStyle(fontWeight: FontWeight.w700, decoration: l.voided ? TextDecoration.lineThrough : null)),
                    if (l.type == 'order_commission') Text('${rateText(l.commissionType, l.commissionValue)} of ${formatUsd(l.orderSubtotal)}', style: const TextStyle(color: AppTheme.neutral)),
                    if (l.voided) Text('Cancelled${l.voidReason == null ? '' : ': ${l.voidReason}'}', style: const TextStyle(color: AppTheme.danger, fontSize: 13)),
                    Text('${formatDateTime(l.createdAt)} · owed after: ${formatUsd(l.dueAfter)}', style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
                  ]),
                ),
                Text(formatUsd(l.amount), style: const TextStyle(fontWeight: FontWeight.w800)),
              ]),
            ),
          ),
          CursorList<Disbursement>(
            fetch: api.disbursementsFetcher(),
            emptyText: 'You have not paid the marketplace yet.',
            emptyIcon: Icons.payments_outlined,
            itemBuilder: (context, d) => AppCard(
              onTap: () => context.push('/more/commission/payments/${d.id}'),
              child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(formatDate(d.createdAt), style: const TextStyle(fontWeight: FontWeight.w700)), if (d.notes != null) Text(d.notes!, style: const TextStyle(color: AppTheme.neutral))])),
                Text(formatUsd(d.amount), style: const TextStyle(fontWeight: FontWeight.w800)),
              ]),
            ),
          ),
          CursorList<RateChange>(
            fetch: api.rateChangesFetcher(),
            emptyText: 'The rate has not changed.',
            emptyIcon: Icons.history,
            itemBuilder: (_, c) => AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(c.fromText == null || c.fromText!.isEmpty ? 'Set to ${c.toText}' : '${c.fromText} to ${c.toText}', style: const TextStyle(fontWeight: FontWeight.w700)),
                if (c.note != null) Text(c.note!),
                Text('${c.by ?? ''} · ${formatDateTime(c.at)}', style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

class _Balance extends ConsumerWidget {
  const _Balance();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(commissionBalanceProvider);
    return data.when(
      loading: () => const LoadingView(),
      error: (e, _) => ErrorView(message: ApiException.from(e).message, onRetry: () => ref.invalidate(commissionBalanceProvider)),
      data: (b) => RefreshIndicator(
        onRefresh: () => ref.refresh(commissionBalanceProvider.future).then((_) {}),
        child: ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.all(AppSpacing.m), children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.m),
            decoration: BoxDecoration(color: b.due > 0 ? AppTheme.warning : AppTheme.success, borderRadius: BorderRadius.circular(12)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('You owe the marketplace', style: TextStyle(color: Colors.white70)),
              Text(formatUsd(b.due), style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w800)),
            ]),
          ),
          const SizedBox(height: AppSpacing.m),
          AppCard(child: Column(children: [KeyValue('Charged in total', formatUsd(b.total)), KeyValue('Paid so far', formatUsd(b.paid)), KeyValue('Still owed', formatUsd(b.due), bold: true)])),
          const SizedBox(height: AppSpacing.m),
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              KeyValue('Your rate', rateText(b.rateType, b.rateValue), bold: true),
              Text(b.rateSource == 'seller' ? 'Set for your shop.' : 'The marketplace standard rate.', style: const TextStyle(color: AppTheme.neutral)),
            ]),
          ),
        ]),
      ),
    );
  }
}
