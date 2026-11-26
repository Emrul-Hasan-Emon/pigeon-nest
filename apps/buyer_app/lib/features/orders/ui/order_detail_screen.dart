import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/format/money.dart';
import '../../../shared/format/text.dart';
import '../../../shared/media/image_picker_helper.dart';
import '../../../shared/widgets/catalogue_plate.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/order_api.dart';
import '../data/order_models.dart';
import 'order_tone.dart';

final orderDetailProvider = FutureProvider.family<OrderDetail, int>((ref, id) => ref.read(orderApiProvider).detail(id));

/// One order: items, totals, delivery and address, payment status and "mark
/// as paid", status history and seller updates. Also the screen checkout
/// lands on right after placing an order (its status starts at "pending").
class OrderDetailScreen extends ConsumerWidget {
  const OrderDetailScreen({super.key, required this.id, this.justPlaced = false});
  final int id;
  final bool justPlaced;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(orderDetailProvider(id));
    return Scaffold(
      appBar: AppBar(
        title: Text(async.asData?.value == null ? 'Order' : '#${async.asData!.value.orderNumber}'),
        automaticallyImplyLeading: !justPlaced,
      ),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: 'Could not load this order.', onRetry: () => ref.invalidate(orderDetailProvider(id))),
        data: (order) => _Detail(order: order, justPlaced: justPlaced),
      ),
    );
  }
}

class _Detail extends ConsumerWidget {
  const _Detail({required this.order, required this.justPlaced});
  final OrderDetail order;
  final bool justPlaced;

  Future<void> _cancel(BuildContext context, WidgetRef ref) async {
    final reason = await showDialog<String>(
      context: context,
      builder: (dialogContext) {
        final controller = TextEditingController();
        return AlertDialog(
          title: const Text('Cancel this order?'),
          content: TextField(controller: controller, decoration: const InputDecoration(labelText: 'Reason (optional)')),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Keep order')),
            FilledButton(onPressed: () => Navigator.pop(dialogContext, controller.text), child: const Text('Cancel order')),
          ],
        );
      },
    );
    if (reason == null) return;
    await ref.read(orderApiProvider).cancel(order.id, reason: reason.isEmpty ? null : reason);
    ref.invalidate(orderDetailProvider(order.id));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.m),
      children: [
        if (justPlaced)
          Container(
            margin: const EdgeInsets.only(bottom: AppSpacing.m),
            padding: const EdgeInsets.all(AppSpacing.m),
            decoration: BoxDecoration(color: AppTheme.success.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
            child: Row(children: const [Icon(Icons.check_circle, color: AppTheme.success), SizedBox(width: AppSpacing.s), Expanded(child: Text('Thank you! Your order was placed.'))]),
          ),
        Row(
          children: [
            StatusBadge(label: statusLabel(order.status), tone: orderStatusTone(order.status)),
            const SizedBox(width: AppSpacing.s),
            StatusBadge(label: statusLabel(order.paymentStatus), tone: paymentStatusTone(order.paymentStatus)),
            const Spacer(),
            Text(formatDate(order.createdAt), style: const TextStyle(color: AppTheme.slate, fontSize: 12)),
          ],
        ),
        const SizedBox(height: AppSpacing.m),
        Text(order.sellerName, style: Theme.of(context).textTheme.titleMedium),
        const Divider(height: AppSpacing.l),
        for (final item in order.items)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.s),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 48,
                  child: CataloguePlate(
                    child: item.imageUrl != null ? Image.network(item.imageUrl!, fit: BoxFit.cover) : Container(color: AppTheme.dove, child: const Icon(Icons.image_outlined, size: 16, color: AppTheme.slate)),
                  ),
                ),
                const SizedBox(width: AppSpacing.s),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.productName, style: const TextStyle(fontWeight: FontWeight.w600)),
                      if (item.skuLabel.isNotEmpty) Text(item.skuLabel, style: const TextStyle(color: AppTheme.slate, fontSize: 12)),
                      Text('${item.quantity} × ${formatUsd(item.unitPayable)}', style: const TextStyle(color: AppTheme.slate, fontSize: 12)),
                    ],
                  ),
                ),
                Text(formatUsd(item.lineTotal), style: const TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        const Divider(),
        _row('Subtotal', formatUsd(order.subtotal)),
        _row('Delivery', formatUsd(order.deliveryCharge)),
        _row('Total', formatUsd(order.payable), bold: true),
        if (order.amountPaid > 0) _row('Paid', formatUsd(order.amountPaid)),
        if (order.balanceDue > 0) _row('Balance due', formatUsd(order.balanceDue), color: AppTheme.danger),
        const SizedBox(height: AppSpacing.l),
        Text('Delivery', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSpacing.xs),
        Text('${statusLabel(order.delivery)} to ${order.recipientName}'),
        Text(order.phone),
        Text('${order.addressLine}, ${order.city}, ${order.countryName}'),
        if (order.note != null) ...[
          const SizedBox(height: AppSpacing.s),
          Text('Note: ${order.note}', style: const TextStyle(color: AppTheme.slate)),
        ],
        if (order.canClaimPayment && order.payTo.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.l),
          Text('Pay to', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.xs),
          for (final a in order.payTo)
            Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Text('${a.provider} — ${a.accountNumber}${a.accountName != null ? ' (${a.accountName})' : ''}', style: const TextStyle(fontSize: 13)),
            ),
        ],
        if (order.statusHistory.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.l),
          Text('Status history', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.xs),
          for (final h in order.statusHistory)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(children: [Text(statusLabel(h.status), style: const TextStyle(fontWeight: FontWeight.w600)), const SizedBox(width: AppSpacing.s), Text(formatDateTime(h.createdAt), style: const TextStyle(color: AppTheme.slate, fontSize: 12))]),
            ),
        ],
        if (order.updates.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.l),
          Text('Updates from the seller', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.xs),
          for (final u in order.updates)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.s),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [if (u.message != null) Text(u.message!), Text(formatDateTime(u.createdAt), style: const TextStyle(color: AppTheme.slate, fontSize: 11))]),
            ),
        ],
        const SizedBox(height: AppSpacing.l),
        if (order.canCancel)
          OutlinedButton(onPressed: () => _cancel(context, ref), child: const Text('Cancel order')),
        if (order.canClaimPayment && ref.watch(authProvider).status == AuthStatus.signedIn) ...[
          const SizedBox(height: AppSpacing.s),
          FilledButton(onPressed: () => _openPaymentClaim(context, ref), child: const Text('I have paid')),
        ],
        if (order.status == 'delivered') ...[
          const SizedBox(height: AppSpacing.s),
          OutlinedButton(onPressed: () => context.push('/returns/request/${order.id}'), child: const Text('Request a return')),
        ],
      ],
    );
  }

  Widget _row(String label, String value, {bool bold = false, Color? color}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [Text(label), Text(value, style: TextStyle(fontWeight: bold ? FontWeight.w700 : FontWeight.normal, color: color))],
        ),
      );

  Future<void> _openPaymentClaim(BuildContext context, WidgetRef ref) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: _PaymentClaimSheet(order: order),
      ),
    );
    ref.invalidate(orderDetailProvider(order.id));
  }
}

class _PaymentClaimSheet extends ConsumerStatefulWidget {
  const _PaymentClaimSheet({required this.order});
  final OrderDetail order;

  @override
  ConsumerState<_PaymentClaimSheet> createState() => _PaymentClaimSheetState();
}

class _PaymentClaimSheetState extends ConsumerState<_PaymentClaimSheet> {
  final _form = GlobalKey<FormState>();
  final _amount = TextEditingController();
  final _transactionId = TextEditingController();
  final _method = TextEditingController();
  final _senderNumber = TextEditingController();
  final _note = TextEditingController();
  final _files = <XFile>[];
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _amount.text = widget.order.balanceDue.toStringAsFixed(2);
  }

  Future<void> _addPhoto() async {
    final file = await ImagePickerHelper.pickFromGallery();
    if (file != null) setState(() => _files.add(file));
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate() || _files.isEmpty) {
      setState(() => _error = _files.isEmpty ? 'Add at least one photo of the payment.' : null);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(orderApiProvider).submitPaymentClaim(
            widget.order.id,
            amount: num.parse(_amount.text),
            transactionId: _transactionId.text,
            method: _method.text,
            senderNumber: _senderNumber.text.isEmpty ? null : _senderNumber.text,
            note: _note.text.isEmpty ? null : _note.text,
            files: _files,
          );
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not submit: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _amount.dispose();
    _transactionId.dispose();
    _method.dispose();
    _senderNumber.dispose();
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.m),
      child: Form(
        key: _form,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Mark as paid', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: AppSpacing.m),
            TextFormField(controller: _amount, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Amount paid'), validator: _required),
            const SizedBox(height: AppSpacing.m),
            TextFormField(controller: _method, decoration: const InputDecoration(labelText: 'How you paid (bKash, bank...)'), validator: _required),
            const SizedBox(height: AppSpacing.m),
            TextFormField(controller: _transactionId, decoration: const InputDecoration(labelText: 'Transaction ID'), validator: _required),
            const SizedBox(height: AppSpacing.m),
            TextFormField(controller: _senderNumber, decoration: const InputDecoration(labelText: 'Sent from (optional)')),
            const SizedBox(height: AppSpacing.m),
            TextFormField(controller: _note, decoration: const InputDecoration(labelText: 'Note (optional)'), maxLines: 2),
            const SizedBox(height: AppSpacing.m),
            Wrap(
              spacing: AppSpacing.s,
              children: [
                for (final f in _files) SizedBox(width: 56, height: 56, child: CataloguePlate(child: Image.file(File(f.path)))),
                OutlinedButton.icon(onPressed: _addPhoto, icon: const Icon(Icons.add_a_photo_outlined), label: const Text('Add proof')),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.s),
              Text(_error!, style: const TextStyle(color: AppTheme.danger)),
            ],
            const SizedBox(height: AppSpacing.l),
            PrimaryButton(label: 'Submit', busy: _busy, onPressed: _submit),
          ],
        ),
      ),
    );
  }

  String? _required(String? v) => (v == null || v.trim().isEmpty) ? 'Required' : null;
}
