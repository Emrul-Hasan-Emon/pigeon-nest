import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/format/money.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/attachment_strip.dart';
import '../../../shared/widgets/paged_list.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/payment_models.dart';
import '../data/payments_api.dart';

StatusTone _tone(String s) => switch (s) {
      'confirmed' => StatusTone.success,
      'rejected' => StatusTone.danger,
      'pending' => StatusTone.warning,
      _ => StatusTone.neutral,
    };

/// "I have paid" messages from buyers. Confirming records the money on the order.
class ClaimsScreen extends ConsumerStatefulWidget {
  const ClaimsScreen({super.key});

  @override
  ConsumerState<ClaimsScreen> createState() => _ClaimsScreenState();
}

class _ClaimsScreenState extends ConsumerState<ClaimsScreen> {
  String? _status = 'pending';
  int _version = 0;

  void _say(String t) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t)));

  Future<void> _confirm(Claim c) async {
    final amount = TextEditingController(text: c.amount.toStringAsFixed(2));
    final note = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm this payment'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('Only confirm after the money reached you. Change the amount if you got a different one.'),
          const SizedBox(height: AppSpacing.m),
          TextField(controller: amount, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Amount received (USD)', prefixText: '\$ ')),
          const SizedBox(height: AppSpacing.s),
          TextField(controller: note, maxLength: 500, decoration: const InputDecoration(labelText: 'Note (optional)')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Back')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), style: FilledButton.styleFrom(minimumSize: const Size(110, 48)), child: const Text('Confirm')),
        ],
      ),
    );
    if (ok != true) return;
    final value = double.tryParse(amount.text.trim());
    if (value == null || value < 0.01) return _say('Enter an amount of 0.01 or more.');
    await _run(() => ref.read(paymentsApiProvider).confirmClaim(c.id, amount: value, note: note.text));
  }

  Future<void> _reject(Claim c) async {
    final reason = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject this payment'),
        content: TextField(controller: reason, maxLength: 500, decoration: const InputDecoration(labelText: 'Why? The buyer sees this')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Back')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), style: FilledButton.styleFrom(minimumSize: const Size(110, 48), backgroundColor: AppTheme.danger), child: const Text('Reject')),
        ],
      ),
    );
    if (ok != true) return;
    if (reason.text.trim().length < 3) return _say('Write a reason of at least 3 characters.');
    await _run(() => ref.read(paymentsApiProvider).rejectClaim(c.id, reason.text));
  }

  Future<void> _run(Future<void> Function() action) async {
    try {
      await action();
      if (mounted) setState(() => _version++);
    } on ApiException catch (e) {
      if (mounted) _say(e.message);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Paid requests')),
        body: Column(children: [
          SizedBox(
            height: 52,
            child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.all(AppSpacing.s), children: [
              for (final (label, value) in const [('Waiting', 'pending'), ('Confirmed', 'confirmed'), ('Rejected', 'rejected'), ('All', null)])
                Padding(padding: const EdgeInsets.only(right: AppSpacing.s), child: ChoiceChip(label: Text(label), selected: _status == value, onSelected: (_) => setState(() => _status = value))),
            ]),
          ),
          Expanded(
            child: PagedList<Claim>(
              fetch: ref.read(paymentsApiProvider).claimsFetcher(status: _status),
              reloadKey: '$_status|$_version',
              emptyText: 'Nothing here.',
              emptyIcon: Icons.fact_check_outlined,
              itemBuilder: (context, c) => AppCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text('${c.orderNumber} · ${c.buyerName}', style: const TextStyle(fontWeight: FontWeight.w700))),
                    StatusBadge(label: c.status[0].toUpperCase() + c.status.substring(1), tone: _tone(c.status)),
                  ]),
                  const SizedBox(height: AppSpacing.xs),
                  Text('${formatUsd(c.amount)} of ${formatUsd(c.orderPayable)} · ${c.method ?? ''}', style: const TextStyle(fontWeight: FontWeight.w600)),
                  if (c.transactionId != null) Text('Transaction: ${c.transactionId}'),
                  if (c.senderNumber != null) Text('From: ${c.senderNumber}'),
                  if (c.paidOn != null) Text('Paid on: ${c.paidOn}'),
                  if (c.note != null) Text(c.note!, style: const TextStyle(fontStyle: FontStyle.italic)),
                  if (c.decisionNote != null) Text('Decision: ${c.decisionNote}', style: const TextStyle(color: AppTheme.neutral)),
                  Text(formatDateTime(c.createdAt), style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
                  if (c.attachments.isNotEmpty) Padding(padding: const EdgeInsets.only(top: AppSpacing.s), child: AttachmentStrip(c.attachments)),
                  if (c.pending) ...[
                    const SizedBox(height: AppSpacing.s),
                    Row(children: [
                      Expanded(child: OutlinedButton(onPressed: () => _reject(c), style: OutlinedButton.styleFrom(foregroundColor: AppTheme.danger), child: const Text('Reject'))),
                      const SizedBox(width: AppSpacing.s),
                      Expanded(child: FilledButton(onPressed: () => _confirm(c), style: FilledButton.styleFrom(minimumSize: const Size(0, 48)), child: const Text('Confirm'))),
                    ]),
                  ],
                ]),
              ),
            ),
          ),
        ]),
      );
}
