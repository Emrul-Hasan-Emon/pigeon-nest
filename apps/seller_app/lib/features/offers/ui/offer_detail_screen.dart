import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/format/money.dart';
import '../../../shared/format/text.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/key_value.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/section_title.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/offer_models.dart';
import '../data/offers_api.dart';
import 'offers_screen.dart';

class OfferDetailScreen extends ConsumerStatefulWidget {
  const OfferDetailScreen({super.key, required this.offerId});
  final int offerId;

  @override
  ConsumerState<OfferDetailScreen> createState() => _OfferDetailScreenState();
}

class _OfferDetailScreenState extends ConsumerState<OfferDetailScreen> {
  bool _busy = false;

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
      ref.invalidate(offerProvider(widget.offerId));
      ref.invalidate(offerSummaryProvider);
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Asks for a note (and, when [counter], a new price and quantity). Null when the seller backs out.
  Future<({String note, double? price, int? quantity})?> _ask(Offer o, String title, String action, {bool counter = false, bool danger = false}) {
    final note = TextEditingController();
    final price = TextEditingController(text: o.price.toStringAsFixed(2));
    final qty = TextEditingController(text: '${o.quantity}');
    String? error;
    return showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => AlertDialog(
          title: Text(title),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            if (counter) ...[
              TextField(controller: price, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Your price for each (USD)', prefixText: '\$ ')),
              const SizedBox(height: AppSpacing.s),
              TextField(controller: qty, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantity')),
              const SizedBox(height: AppSpacing.s),
            ],
            TextField(controller: note, maxLength: 500, decoration: const InputDecoration(labelText: 'Note for the buyer (optional)')),
            if (error != null) Text(error!, style: const TextStyle(color: AppTheme.danger)),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Back')),
            FilledButton(
              onPressed: () {
                final p = double.tryParse(price.text.trim());
                final q = int.tryParse(qty.text.trim());
                if (counter && (p == null || p < 0.01)) return set(() => error = 'Enter a price of 0.01 or more.');
                if (counter && (q == null || q < 1)) return set(() => error = 'Enter a quantity.');
                Navigator.pop(ctx, (note: note.text, price: counter ? p : null, quantity: counter ? q : null));
              },
              style: FilledButton.styleFrom(minimumSize: const Size(110, 48), backgroundColor: danger ? AppTheme.danger : null),
              child: Text(action),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(offerProvider(widget.offerId));
    final api = ref.read(offersApiProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Price offer')),
      body: data.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: ApiException.from(e).message, onRetry: () => ref.invalidate(offerProvider(widget.offerId))),
        data: (o) => ListView(padding: const EdgeInsets.all(AppSpacing.m), children: [
          Row(children: [StatusBadge(label: o.awaitingYou ? 'Waiting for you' : statusLabel(o.status), tone: o.awaitingYou ? StatusTone.danger : offerTone(o.status))]),
          const SizedBox(height: AppSpacing.m),
          if (o.actions.contains('accept'))
            FilledButton(onPressed: _busy ? null : () async { final r = await _ask(o, 'Accept this offer', 'Accept'); if (r != null) _run(() => api.accept(o.id, note: r.note)); }, child: const Text('Accept')),
          if (o.actions.contains('counter')) ...[
            const SizedBox(height: AppSpacing.s),
            OutlinedButton(
              onPressed: _busy ? null : () async { final r = await _ask(o, 'Counter with your price', 'Send', counter: true); if (r != null) _run(() => api.counter(o.id, price: r.price!, quantity: r.quantity, note: r.note)); },
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(56), foregroundColor: AppTheme.ink),
              child: const Text('Counter with another price'),
            ),
          ],
          if (o.actions.contains('reject')) ...[
            const SizedBox(height: AppSpacing.s),
            OutlinedButton(
              onPressed: _busy ? null : () async { final r = await _ask(o, 'Reject this offer', 'Reject', danger: true); if (r != null) _run(() => api.reject(o.id, note: r.note)); },
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(56), foregroundColor: AppTheme.danger),
              child: const Text('Reject'),
            ),
          ],
          const SizedBox(height: AppSpacing.m),
          AppCard(
            child: Column(children: [
              KeyValue('Product', o.productName),
              if (o.skuLabel != null) KeyValue('Option', o.skuLabel!),
              KeyValue('Buyer', o.buyerName),
              KeyValue('Offer', '${o.quantity} × ${formatUsd(o.price)}'),
              KeyValue('Total', formatUsd(o.total), bold: true),
              KeyValue('Your price now', formatUsd(o.skuPriceNow)),
              KeyValue('In stock', '${o.stock}'),
              if (o.closeNote != null) KeyValue('Closing note', o.closeNote!),
            ]),
          ),
          const SizedBox(height: AppSpacing.m),
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const SectionTitle('Back and forth'),
              for (final h in o.history)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${statusLabel(h.action)}: ${h.quantity} × ${formatUsd(h.price)}', style: const TextStyle(fontWeight: FontWeight.w600)),
                    if (h.note != null) Text(h.note!),
                    Text('${h.by ?? ''} · ${formatDateTime(h.at)}', style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
                  ]),
                ),
            ]),
          ),
        ]),
      ),
    );
  }
}
