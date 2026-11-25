import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

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
import '../../../shared/widgets/photo_picker_row.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/return_models.dart';
import '../data/returns_api.dart';
import 'refunds_screen.dart';

class RefundDetailScreen extends ConsumerStatefulWidget {
  const RefundDetailScreen({super.key, required this.refundId});
  final int refundId;

  @override
  ConsumerState<RefundDetailScreen> createState() => _RefundDetailScreenState();
}

class _RefundDetailScreenState extends ConsumerState<RefundDetailScreen> {
  bool _busy = false;

  Future<void> _step(RefundRecord r) async {
    final next = r.next!;
    final note = TextEditingController();
    final amount = TextEditingController(text: r.expectedAmount.toStringAsFixed(2));
    final txn = TextEditingController();
    var files = <XFile>[];
    String? error;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => AlertDialog(
          title: Text(next == 'refunded' ? 'I sent the money back' : 'Start refunding'),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (next == 'refunded') ...[
                Text('The amount must be exactly what the buyer paid: ${formatUsd(r.expectedAmount)}.'),
                TextField(controller: amount, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Amount sent (USD)', prefixText: '\$ ')),
                TextField(controller: txn, maxLength: 120, decoration: const InputDecoration(labelText: 'Transaction ID (optional)')),
              ],
              TextField(controller: note, maxLines: 2, maxLength: 1000, decoration: InputDecoration(labelText: next == 'refunded' ? 'How you sent it (required)' : 'Note (optional)')),
              if (next == 'refunded') ...[const Text('Proof (at least one picture)'), const SizedBox(height: AppSpacing.xs), PhotoPickerRow(files: files, onChanged: (f) => set(() => files = f))],
              if (error != null) Text(error!, style: const TextStyle(color: AppTheme.danger)),
            ]),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Back')),
            FilledButton(
              onPressed: () {
                if (next == 'refunded') {
                  final n = double.tryParse(amount.text.trim());
                  if (n == null) return set(() => error = 'Enter the amount.');
                  if (note.text.trim().isEmpty) return set(() => error = 'Say how you sent it.');
                  if (files.isEmpty) return set(() => error = 'Add a picture of the proof.');
                }
                Navigator.pop(ctx, true);
              },
              style: FilledButton.styleFrom(minimumSize: const Size(110, 48)),
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      await ref.read(returnsApiProvider).changeRefund(
            r.id,
            next,
            amount: next == 'refunded' ? double.parse(amount.text.trim()) : null,
            note: note.text,
            transactionId: txn.text,
            files: files,
          );
      ref.invalidate(refundDetailProvider(r.id));
      ref.invalidate(refundSummaryProvider);
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(refundDetailProvider(widget.refundId));
    return Scaffold(
      appBar: AppBar(title: const Text('Refund')),
      body: data.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: ApiException.from(e).message, onRetry: () => ref.invalidate(refundDetailProvider(widget.refundId))),
        data: (r) => ListView(padding: const EdgeInsets.all(AppSpacing.m), children: [
          Row(children: [StatusBadge(label: statusLabel(r.status), tone: refundTone(r.status))]),
          const SizedBox(height: AppSpacing.m),
          if (r.next != null) FilledButton(onPressed: _busy ? null : () => _step(r), child: Text(r.next == 'refunded' ? 'I sent the money back' : 'Start refunding')),
          const SizedBox(height: AppSpacing.m),
          AppCard(
            child: Column(children: [
              KeyValue('Amount to send back', formatUsd(r.expectedAmount), bold: true),
              if (r.amount != null) KeyValue('Amount sent', formatUsd(r.amount!)),
              if (r.refundedAt != null) KeyValue('Sent on', formatDateTime(r.refundedAt!)),
              if (r.transactionId != null) KeyValue('Transaction', r.transactionId!),
            ]),
          ),
          if (r.note != null) ...[const SizedBox(height: AppSpacing.m), AppCard(child: Text(r.note!))],
          if (r.proof.isNotEmpty) ...[const SizedBox(height: AppSpacing.m), AppCard(child: AttachmentStrip(r.proof))],
        ]),
      ),
    );
  }
}
