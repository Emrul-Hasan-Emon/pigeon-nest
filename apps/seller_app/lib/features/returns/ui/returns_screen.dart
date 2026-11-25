import 'dart:async';

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

StatusTone returnTone(String s) => switch (s) {
      'returned' => StatusTone.success,
      'rejected' || 'cancelled' => StatusTone.danger,
      'return_requested' => StatusTone.warning,
      _ => StatusTone.info,
    };

class ReturnsScreen extends ConsumerStatefulWidget {
  const ReturnsScreen({super.key});

  @override
  ConsumerState<ReturnsScreen> createState() => _ReturnsScreenState();
}

class _ReturnsScreenState extends ConsumerState<ReturnsScreen> {
  String? _status;
  String _search = '';
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Returns')),
        body: Column(children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.m),
            child: TextField(
              decoration: const InputDecoration(hintText: 'Return or order number', prefixIcon: Icon(Icons.search)),
              onChanged: (v) {
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 500), () => setState(() => _search = v));
              },
            ),
          ),
          SizedBox(
            height: 44,
            child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m), children: [
              for (final (label, value) in const [
                ('All', null),
                ('Asked for', 'return_requested'),
                ('Accepted', 'accepted'),
                ('Processing', 'processing'),
                ('Returning money', 'returning_money'),
                ('Returned', 'returned'),
                ('Rejected', 'rejected'),
              ])
                Padding(padding: const EdgeInsets.only(right: AppSpacing.s), child: ChoiceChip(label: Text(label), selected: _status == value, onSelected: (_) => setState(() => _status = value))),
            ]),
          ),
          Expanded(
            child: PagedList<ReturnRow>(
              fetch: ref.read(returnsApiProvider).returnsFetcher(status: _status, search: _search),
              reloadKey: '$_status|$_search',
              emptyText: 'No returns.',
              emptyIcon: Icons.assignment_return_outlined,
              itemBuilder: (context, r) => AppCard(
                onTap: () => context.push('/more/returns/${r.id}'),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(r.returnNumber, style: const TextStyle(fontWeight: FontWeight.w700)),
                      Text('Order ${r.orderNumber}', style: const TextStyle(color: AppTheme.neutral)),
                      if (r.productName != null) Text('${r.productName}${r.itemCount > 1 ? ' +${r.itemCount - 1}' : ''}', maxLines: 1, overflow: TextOverflow.ellipsis),
                      if (r.reasonCode != null) Text(returnReasons[r.reasonCode] ?? statusLabel(r.reasonCode!), style: const TextStyle(color: AppTheme.neutral, fontSize: 13)),
                      Text(formatDate(r.createdAt), style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
                      const SizedBox(height: AppSpacing.xs),
                      StatusBadge(label: statusLabel(r.status), tone: returnTone(r.status)),
                    ]),
                  ),
                  Text(formatUsd(r.refundAmount), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                ]),
              ),
            ),
          ),
        ]),
      );
}
