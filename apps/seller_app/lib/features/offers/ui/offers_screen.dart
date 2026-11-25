import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/format/money.dart';
import '../../../shared/format/text.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/cursor_list.dart';
import '../../../shared/widgets/image_thumb.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/offer_models.dart';
import '../data/offers_api.dart';

StatusTone offerTone(String s) => switch (s) {
      'accepted' || 'used' => StatusTone.success,
      'rejected' || 'cancelled' => StatusTone.danger,
      _ => StatusTone.warning,
    };

class OffersScreen extends ConsumerStatefulWidget {
  const OffersScreen({super.key});

  @override
  ConsumerState<OffersScreen> createState() => _OffersScreenState();
}

class _OffersScreenState extends ConsumerState<OffersScreen> {
  // 'you' = waiting for the seller; otherwise a status or null for all.
  String? _filter = 'you';

  @override
  Widget build(BuildContext context) {
    final sum = ref.watch(offerSummaryProvider).value;
    final chips = [
      (sum == null ? 'Waiting for you' : 'Waiting for you (${sum.awaitingYou})', 'you'),
      ('All', null),
      ('Pending', 'pending'),
      ('Accepted', 'accepted'),
      ('Rejected', 'rejected'),
      ('Used', 'used'),
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('Price offers')),
      body: Column(children: [
        SizedBox(
          height: 52,
          child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.all(AppSpacing.s), children: [
            for (final (label, value) in chips)
              Padding(padding: const EdgeInsets.only(right: AppSpacing.s), child: ChoiceChip(label: Text(label), selected: _filter == value, onSelected: (_) => setState(() => _filter = value))),
          ]),
        ),
        Expanded(
          child: CursorList<Offer>(
            fetch: ref.read(offersApiProvider).listFetcher(status: _filter == 'you' ? null : _filter, awaitingYou: _filter == 'you'),
            reloadKey: _filter,
            emptyText: 'No offers here.',
            emptyIcon: Icons.local_offer_outlined,
            itemBuilder: (context, o) => AppCard(
              onTap: () async {
                await context.push('/more/offers/${o.id}');
                ref.invalidate(offerSummaryProvider);
              },
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                ImageThumb(o.productImage, size: 56),
                const SizedBox(width: AppSpacing.m),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(o.productName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                    Text('${o.buyerName} · ${o.quantity} × ${formatUsd(o.price)}', style: const TextStyle(color: AppTheme.neutral)),
                    Text('Your price ${formatUsd(o.skuPriceNow)} · ${formatDate(o.createdAt)}', style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
                    const SizedBox(height: AppSpacing.xs),
                    StatusBadge(label: o.awaitingYou ? 'Waiting for you' : statusLabel(o.status), tone: o.awaitingYou ? StatusTone.danger : offerTone(o.status)),
                  ]),
                ),
                Text(formatUsd(o.total), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}
