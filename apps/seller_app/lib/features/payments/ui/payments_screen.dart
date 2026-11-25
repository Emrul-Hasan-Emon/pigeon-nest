import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/format/money.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/cursor_list.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/payment_models.dart';
import '../data/payments_api.dart';

/// Money recorded on the seller's orders, newest first.
class PaymentsScreen extends ConsumerStatefulWidget {
  const PaymentsScreen({super.key});

  @override
  ConsumerState<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends ConsumerState<PaymentsScreen> {
  String? _status;
  String _search = '';
  final _controller = TextEditingController();
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Payments')),
        body: Column(children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.m),
            child: TextField(
              controller: _controller,
              decoration: const InputDecoration(hintText: 'Order number', prefixIcon: Icon(Icons.search)),
              onChanged: (v) {
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 500), () => setState(() => _search = v));
              },
            ),
          ),
          SizedBox(
            height: 44,
            child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m), children: [
              for (final (label, value) in const [('All', null), ('Waiting', 'due'), ('Part paid', 'partially_paid'), ('Paid', 'paid')])
                Padding(padding: const EdgeInsets.only(right: AppSpacing.s), child: ChoiceChip(label: Text(label), selected: _status == value, onSelected: (_) => setState(() => _status = value))),
            ]),
          ),
          Expanded(
            child: CursorList<PaymentRow>(
              fetch: ref.read(paymentsApiProvider).listFetcher(status: _status, search: _search),
              reloadKey: '$_status|$_search',
              emptyText: 'No payments match.',
              emptyIcon: Icons.payments_outlined,
              itemBuilder: (context, p) => AppCard(
                onTap: () => context.push('/more/payments/${p.id}'),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(p.orderNumber, style: const TextStyle(fontWeight: FontWeight.w700)),
                      Text(p.customerName, style: const TextStyle(color: AppTheme.neutral)),
                      Text(formatDate(p.paidAt ?? p.createdAt), style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
                      const SizedBox(height: AppSpacing.xs),
                      if (p.reversed)
                        const StatusBadge(label: 'Reversed', tone: StatusTone.danger)
                      else
                        StatusBadge(label: p.received ? 'Received' : 'Not received yet', tone: p.received ? StatusTone.success : StatusTone.neutral),
                    ]),
                  ),
                  Text(formatUsd(p.amount), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                ]),
              ),
            ),
          ),
        ]),
      );
}
