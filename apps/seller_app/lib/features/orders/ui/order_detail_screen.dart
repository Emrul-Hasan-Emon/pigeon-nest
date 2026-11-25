import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/format/money.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/order_models.dart';
import '../data/order_api.dart';
import 'invoice.dart';
import 'order_ui.dart';
import '../../../shared/widgets/image_thumb.dart';
import '../../../shared/widgets/key_value.dart';
import '../../../shared/widgets/section_title.dart';
import '../../../shared/format/text.dart';

class OrderDetailScreen extends ConsumerWidget {
  const OrderDetailScreen({super.key, required this.orderId});
  final int orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(orderDetailProvider(orderId));
    return Scaffold(
      appBar: AppBar(
        title: Text(data.value?.row.orderNumber ?? 'Order'),
        actions: [
          if (data.value != null)
            IconButton(tooltip: 'Invoice', icon: const Icon(Icons.picture_as_pdf_outlined), onPressed: () => shareInvoice(context, data.value!, shopName: ref.read(authProvider).shopName ?? 'Pigeon Nest')),
        ],
      ),
      body: data.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: ApiException.from(e).message, onRetry: () => ref.invalidate(orderDetailProvider(orderId))),
        data: (o) => RefreshIndicator(
          onRefresh: () => ref.refresh(orderDetailProvider(orderId).future).then((_) {}),
          child: _Body(order: o),
        ),
      ),
    );
  }
}

class _Body extends ConsumerStatefulWidget {
  const _Body({required this.order});
  final OrderDetail order;

  @override
  ConsumerState<_Body> createState() => _BodyState();
}

class _BodyState extends ConsumerState<_Body> {
  bool _busy = false;
  OrderDetail get o => widget.order;

  void _refresh() => ref.invalidate(orderDetailProvider(o.row.id));

  void _say(String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  Future<void> _move(String status) async {
    final note = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(moveLabel(status)),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          if (status == 'cancelled') const Padding(padding: EdgeInsets.only(bottom: 8), child: Text('The stock goes back on the shelf. After this, only an admin can reopen the order.')),
          TextField(controller: note, maxLength: 500, decoration: const InputDecoration(labelText: 'Note for the customer (optional)')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Back')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(minimumSize: const Size(120, 48), backgroundColor: status == 'cancelled' ? AppTheme.danger : null),
            child: Text(moveLabel(status)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      await ref.read(orderRepositoryProvider).changeStatus(o.row.id, status, note: note.text);
      _refresh();
    } on ApiException catch (e) {
      if (mounted) _say(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reverse(OrderPayment p) async {
    final reason = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Reverse ${formatUsd(p.amount)}?'),
        content: TextField(controller: reason, maxLength: 1000, decoration: const InputDecoration(labelText: 'Why (for the record)')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Back')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(minimumSize: const Size(120, 48), backgroundColor: AppTheme.danger),
            child: const Text('Reverse'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    if (reason.text.trim().length < 3) return _say('Write a reason of at least 3 characters.');
    setState(() => _busy = true);
    try {
      await ref.read(orderRepositoryProvider).reversePayment(o.row.id, p.id, reason.text);
      _refresh();
    } on ApiException catch (e) {
      if (mounted) _say(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = o.row;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(AppSpacing.m),
      children: [
        Row(children: [
          StatusBadge(label: statusLabel(r.status), tone: orderTone(r.status)),
          const SizedBox(width: AppSpacing.s),
          StatusBadge(label: statusLabel(r.paymentStatus), tone: paymentTone(r.paymentStatus)),
          const Spacer(),
          Text(formatDateTime(r.createdAt), style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
        ]),
        const SizedBox(height: AppSpacing.m),
        if (r.allowedStatuses.isNotEmpty)
          for (final s in r.allowedStatuses)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.s),
              child: s == 'cancelled'
                  ? OutlinedButton(
                      onPressed: _busy ? null : () => _move(s),
                      style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(56), foregroundColor: AppTheme.danger),
                      child: Text(moveLabel(s)),
                    )
                  : FilledButton(onPressed: _busy ? null : () => _move(s), child: Text(moveLabel(s))),
            ),
        if (o.canRecordPayment)
          OutlinedButton.icon(
            onPressed: _busy
                ? null
                : () async {
                    await context.push('/orders/${r.id}/pay', extra: o);
                    _refresh();
                  },
            icon: const Icon(Icons.payments_outlined),
            label: Text('Record a payment (${formatUsd(o.balanceDue)} due)'),
            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(56), foregroundColor: AppTheme.ink),
          ),
        const SizedBox(height: AppSpacing.m),
        _items(),
        const SizedBox(height: AppSpacing.m),
        _totals(),
        const SizedBox(height: AppSpacing.m),
        _customer(),
        const SizedBox(height: AppSpacing.m),
        _payments(),
        const SizedBox(height: AppSpacing.m),
        _updates(),
        const SizedBox(height: AppSpacing.m),
        _history(),
        const SizedBox(height: AppSpacing.xl),
      ],
    );
  }

  Widget _items() => AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const SectionTitle('Items'),
          for (final i in o.items)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                ImageThumb(i.imageUrl, size: 48),
                const SizedBox(width: AppSpacing.m),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(i.productName, style: const TextStyle(fontWeight: FontWeight.w600)),
                    if (i.skuLabel != null) Text(i.skuLabel!, style: const TextStyle(color: AppTheme.neutral, fontSize: 13)),
                    Text('${i.quantity} × ${formatUsd(i.unitPayable)}', style: const TextStyle(color: AppTheme.neutral, fontSize: 13)),
                    for (final line in i.birdLines) Text(line, style: const TextStyle(fontSize: 13)),
                    if (i.isReturned) const Text('Returned', style: TextStyle(color: AppTheme.danger, fontSize: 13, fontWeight: FontWeight.w600)),
                  ]),
                ),
                Text(formatUsd(i.lineTotal), style: const TextStyle(fontWeight: FontWeight.w700)),
              ]),
            ),
        ]),
      );

  Widget _totals() => AppCard(
        child: Column(children: [
          KeyValue('Items', formatUsd(o.subtotal)),
          if (o.discountAmount > 0) KeyValue('Discount', '-${formatUsd(o.discountAmount)}'),
          KeyValue('Delivery', formatUsd(o.deliveryCharge)),
          const Divider(),
          KeyValue('Total', formatUsd(o.row.payable), bold: true),
          KeyValue('Received', formatUsd(o.row.amountPaid)),
          KeyValue('Still due', formatUsd(o.balanceDue), bold: true, color: o.balanceDue > 0 ? AppTheme.warning : AppTheme.success),
          const Divider(),
          KeyValue('System commission', formatUsd(o.systemCommission)),
          KeyValue('You keep', formatUsd(o.sellerAmount), bold: true),
        ]),
      );

  Widget _customer() => AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const SectionTitle('Customer and delivery'),
          Text(o.recipient ?? o.row.customer.name, style: const TextStyle(fontWeight: FontWeight.w600)),
          if (o.recipientPhone != null) Text(o.recipientPhone!),
          if (o.row.customer.email != null) Text(o.row.customer.email!),
          if (o.row.customer.isGuest) const Text('Guest (no account)', style: TextStyle(color: AppTheme.neutral)),
          const SizedBox(height: AppSpacing.s),
          for (final l in o.addressLines) Text(l),
          const SizedBox(height: AppSpacing.s),
          Text('${statusLabel(o.deliveryType ?? 'standard')} delivery${o.estimatedDays == null ? '' : ' · about ${o.estimatedDays} days'}', style: const TextStyle(color: AppTheme.neutral)),
          if (o.row.gatewayName != null) Text('Pays with: ${o.row.gatewayName}', style: const TextStyle(color: AppTheme.neutral)),
          if (o.customerNote != null) ...[
            const SizedBox(height: AppSpacing.s),
            Text('Customer note: ${o.customerNote}', style: const TextStyle(fontStyle: FontStyle.italic)),
          ],
        ]),
      );

  Widget _payments() => AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const SectionTitle('Payments'),
          if (o.payments.where((p) => p.received || p.reversed).isEmpty) const Text('No money received yet.', style: TextStyle(color: AppTheme.neutral)),
          for (final p in o.payments.where((p) => p.received || p.reversed))
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Text(formatUsd(p.amount), style: TextStyle(fontWeight: FontWeight.w700, decoration: p.reversed ? TextDecoration.lineThrough : null)),
                  const SizedBox(width: AppSpacing.s),
                  if (p.reversed) const StatusBadge(label: 'Reversed', tone: StatusTone.danger),
                  const Spacer(),
                  if (p.paidAt != null) Text(formatDate(p.paidAt!), style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
                ]),
                if (p.description != null) Text(p.description!),
                if (p.transactionId != null) Text('Transaction: ${p.transactionId}', style: const TextStyle(color: AppTheme.neutral, fontSize: 13)),
                if (p.recordedBy != null) Text('Recorded by ${p.recordedBy}', style: const TextStyle(color: AppTheme.neutral, fontSize: 13)),
                if (p.reversalReason != null) Text('Reversed: ${p.reversalReason}', style: const TextStyle(color: AppTheme.danger, fontSize: 13)),
                if (p.attachments.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: AttachmentStrip(p.attachments)),
                if (p.canReverse) TextButton(onPressed: _busy ? null : () => _reverse(p), child: const Text('Reverse this payment')),
              ]),
            ),
        ]),
      );

  Widget _updates() => AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const SectionTitle('Updates'),
          if (o.updates.isEmpty) const Text('No updates posted.', style: TextStyle(color: AppTheme.neutral)),
          for (final u in o.updates)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (u.message != null) Text(u.message!),
                if (u.attachments.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: AttachmentStrip(u.attachments)),
                Text('${u.by ?? ''} · ${formatDateTime(u.at)}', style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
              ]),
            ),
          const SizedBox(height: AppSpacing.s),
          OutlinedButton.icon(
            onPressed: () async {
              await context.push('/orders/${o.row.id}/update');
              _refresh();
            },
            icon: const Icon(Icons.add_comment_outlined),
            label: const Text('Post an update'),
          ),
        ]),
      );

  Widget _history() => AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const SectionTitle('History'),
          for (final h in o.history)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(h.title, style: const TextStyle(fontWeight: FontWeight.w600)),
                if (h.note != null) Text(h.note!),
                Text('${h.by ?? ''} · ${formatDateTime(h.at)}', style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
              ]),
            ),
        ]),
      );
}

/// Proof pictures and files. A picture opens full screen; other files show their name.
class AttachmentStrip extends StatelessWidget {
  const AttachmentStrip(this.items, {super.key});
  final List<Attachment> items;

  @override
  Widget build(BuildContext context) => Wrap(spacing: AppSpacing.s, runSpacing: AppSpacing.s, children: [
        for (final a in items)
          a.isImage
              ? InkWell(
                  onTap: () => showDialog<void>(
                    context: context,
                    builder: (_) => Dialog(child: InteractiveViewer(child: Image.network(a.url))),
                  ),
                  child: ImageThumb(a.url, size: 64),
                )
              : Chip(avatar: const Icon(Icons.attach_file, size: 16), label: Text(a.fileName, overflow: TextOverflow.ellipsis)),
      ]);
}
