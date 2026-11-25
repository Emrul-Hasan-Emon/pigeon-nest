import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/format/money.dart';
import '../../../shared/format/text.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/attachment_strip.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/key_value.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/section_title.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/return_models.dart';
import '../data/returns_api.dart';
import 'return_actions.dart';
import 'returns_screen.dart';

class ReturnDetailScreen extends ConsumerStatefulWidget {
  const ReturnDetailScreen({super.key, required this.returnId});
  final int returnId;

  @override
  ConsumerState<ReturnDetailScreen> createState() => _ReturnDetailScreenState();
}

class _ReturnDetailScreenState extends ConsumerState<ReturnDetailScreen> {
  bool _busy = false;

  Future<StepInput?> _ask(ReturnDetail d, String step) => switch (step) {
        'accept' => askReturnStep(context, title: 'Accept this return', action: 'Accept', askDelivery: d.row.fullOrder, deliveryDefault: d.row.includeDeliveryCharge),
        'reject' => askReturnStep(context, title: 'Reject this return', action: 'Reject', noteRequired: true, danger: true),
        'processing' => askReturnStep(context, title: 'Start processing', action: 'Start'),
        _ => askReturnStep(context, title: 'Money is being returned', action: 'Save', noteRequired: true, askFiles: true),
      };

  Future<void> _do(ReturnDetail d, String step) async {
    final api = ref.read(returnsApiProvider);
    final id = d.row.id;
    final input = await _ask(d, step);
    if (input == null) return;
    setState(() => _busy = true);
    try {
      if (step == 'returning_money') {
        await api.returningMoney(id, note: input.note, files: input.files);
      } else {
        await api.step(id, step, note: input.note, includeDeliveryCharge: input.includeDelivery);
      }
      ref.invalidate(returnDetailProvider(id));
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  static const _labels = {'accept': 'Accept', 'reject': 'Reject', 'processing': 'Start processing', 'returning_money': 'I am returning the money'};

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(returnDetailProvider(widget.returnId));
    return Scaffold(
      appBar: AppBar(title: Text(data.value?.row.returnNumber ?? 'Return')),
      body: data.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: ApiException.from(e).message, onRetry: () => ref.invalidate(returnDetailProvider(widget.returnId))),
        data: (d) => RefreshIndicator(
          onRefresh: () => ref.refresh(returnDetailProvider(widget.returnId).future).then((_) {}),
          child: ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.all(AppSpacing.m), children: [
            Row(children: [StatusBadge(label: statusLabel(d.row.status), tone: returnTone(d.row.status)), const Spacer(), Text(formatDateTime(d.row.createdAt), style: const TextStyle(color: AppTheme.neutral, fontSize: 12))]),
            const SizedBox(height: AppSpacing.m),
            for (final s in d.sellerNext)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.s),
                child: s == 'reject'
                    ? OutlinedButton(onPressed: _busy ? null : () => _do(d, s), style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(56), foregroundColor: AppTheme.danger), child: Text(_labels[s] ?? s))
                    : FilledButton(onPressed: _busy ? null : () => _do(d, s), child: Text(_labels[s] ?? s)),
              ),
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                KeyValue('Order', d.row.orderNumber),
                if (d.customerName != null) KeyValue('Customer', d.customerName!),
                KeyValue('Return of', d.row.fullOrder ? 'The whole order' : 'Some items'),
                if (d.row.reasonCode != null) KeyValue('Reason', returnReasons[d.row.reasonCode] ?? d.row.reasonCode!),
                if (d.row.reason != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(d.row.reason!, style: const TextStyle(fontStyle: FontStyle.italic))),
              ]),
            ),
            const SizedBox(height: AppSpacing.m),
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const SectionTitle('Items'),
                for (final i in d.items) KeyValue('${i.quantity} × ${i.name}${i.skuLabel == null || i.skuLabel!.isEmpty ? '' : ' (${i.skuLabel})'}', formatUsd(i.refundAmount)),
                const Divider(),
                KeyValue('Items', formatUsd(d.itemsAmount)),
                if (d.row.fullOrder) KeyValue('Delivery refunded', formatUsd(d.deliveryAmount)),
                KeyValue('Money to send back', formatUsd(d.row.refundAmount), bold: true),
                KeyValue('System commission given back', formatUsd(d.row.commissionAmount)),
              ]),
            ),
            if (d.moneyRecords.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.m),
              AppCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const SectionTitle('Money records'),
                  for (final r in d.moneyRecords) ...[
                    Text('${statusLabel(r.status)} · ${formatUsd(r.amount ?? r.expectedAmount)}', style: const TextStyle(fontWeight: FontWeight.w600)),
                    if (r.note != null) Text(r.note!),
                    if (r.proof.isNotEmpty) AttachmentStrip(r.proof),
                  ],
                ]),
              ),
            ],
            const SizedBox(height: AppSpacing.m),
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const SectionTitle('History'),
                for (final h in d.history)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(statusLabel(h.status), style: const TextStyle(fontWeight: FontWeight.w600)),
                      if (h.note != null) Text(h.note!),
                      if (h.attachments.isNotEmpty) AttachmentStrip(h.attachments),
                      Text('${h.by ?? ''} · ${formatDateTime(h.at)}', style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
                    ]),
                  ),
              ]),
            ),
            const SizedBox(height: AppSpacing.xl),
          ]),
        ),
      ),
    );
  }
}
