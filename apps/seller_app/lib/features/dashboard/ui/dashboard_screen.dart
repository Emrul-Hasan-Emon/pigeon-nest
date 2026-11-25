import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/money.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/dashboard_models.dart';
import '../data/dashboard_api.dart';
import 'sales_chart.dart';

/// The Home tab for a seller who can manage their shop: every figure comes
/// from one `GET /dashboard` call, filtered by a date range.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(dashboardProvider);
    return RefreshIndicator(
      onRefresh: () async {
        await ref.refresh(dashboardProvider.future).catchError((_) => Dashboard(const {}));
      },
      child: data.when(
        loading: () => const _Scroll(children: [_RangeBar(), SizedBox(height: 240, child: LoadingView())]),
        error: (e, _) => _Scroll(children: [
          const _RangeBar(),
          SizedBox(height: 320, child: ErrorView(message: ApiException.from(e).message, onRetry: () => ref.invalidate(dashboardProvider))),
        ]),
        data: (d) => _Scroll(children: [
          const _RangeBar(),
          _YouKeep(d.totals, balanceDue: d.balanceDue),
          _Attention(d.attention),
          _Panel(title: 'Sales over time', child: SalesChart(series: d.series, monthly: d.monthly)),
          _Orders(d.totals),
          _Panel(title: 'Orders by status', child: _StatusList(d.ordersByStatus)),
          _Panel(title: 'Top products', child: _TopProducts(d.topProducts)),
          _Panel(
            title: 'Reviews',
            onTap: () => context.push('/more/reviews'),
            child: d.reviewCount == 0
                ? const Text('No reviews yet.', style: TextStyle(color: AppTheme.neutral))
                : Row(children: [
                    const Icon(Icons.star, color: AppTheme.warning),
                    const SizedBox(width: AppSpacing.s),
                    Text('${d.reviewAverage?.toStringAsFixed(1) ?? '-'} average', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
                    const SizedBox(width: AppSpacing.s),
                    Text('from ${d.reviewCount} ${d.reviewCount == 1 ? 'review' : 'reviews'}', style: const TextStyle(color: AppTheme.neutral)),
                  ]),
          ),
          _Products(d.products),
          _Wishlist(d),
        ]),
      ),
    );
  }
}

class _Scroll extends StatelessWidget {
  const _Scroll({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppSpacing.m),
        itemCount: children.length,
        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.m),
        itemBuilder: (_, i) => children[i],
      );
}

class _RangeBar extends ConsumerWidget {
  const _RangeBar();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(dashboardRangeProvider);
    return Wrap(
      spacing: AppSpacing.s,
      children: [
        for (final r in DashboardRange.values)
          ChoiceChip(
            label: Text(r.label),
            selected: r == current,
            onSelected: (_) => ref.read(dashboardRangeProvider.notifier).choose(r),
          ),
      ],
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.title, required this.child, this.onTap});
  final String title;
  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => AppCard(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
            const SizedBox(height: AppSpacing.m),
            child,
          ],
        ),
      );
}

/// Percent against the period before; nothing when that period was empty.
class _Change extends StatelessWidget {
  const _Change(this.value);
  final double? value;

  @override
  Widget build(BuildContext context) {
    final v = value;
    if (v == null) return const SizedBox.shrink();
    final up = v >= 0;
    return Text(
      '${up ? '+' : ''}${v.toStringAsFixed(1)}% vs before',
      style: TextStyle(color: up ? AppTheme.success : AppTheme.danger, fontSize: 13, fontWeight: FontWeight.w600),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value, {this.change, this.hint});
  final String label, value;
  final double? change;
  final String? hint;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(label),
                if (hint != null) Text(hint!, style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
              ]),
            ),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
              _Change(change),
            ]),
          ],
        ),
      );
}

/// What the seller actually takes home, with the numbers that explain it.
class _YouKeep extends StatelessWidget {
  const _YouKeep(this.t, {required this.balanceDue});
  final DashboardTotals t;
  final double balanceDue;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(AppSpacing.m),
        decoration: BoxDecoration(color: AppTheme.ink, borderRadius: BorderRadius.circular(12)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('You keep', style: TextStyle(color: Colors.white70)),
            const SizedBox(height: 4),
            Text(formatUsd(t.sellerEarnings), style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w800)),
            if (t.changeEarnings != null)
              Text(
                '${t.changeEarnings! >= 0 ? '+' : ''}${t.changeEarnings!.toStringAsFixed(1)}% vs before',
                style: TextStyle(color: t.changeEarnings! >= 0 ? const Color(0xFF86EFAC) : const Color(0xFFFCA5A5), fontSize: 13),
              ),
            const Divider(color: Colors.white24, height: AppSpacing.l),
            _Support('Sales', formatUsd(t.grossSales)),
            _Support('System commission', formatUsd(t.commissionNet)),
            _Support('Refunds', '${formatUsd(t.refundAmount)} (${t.refundCount})'),
            _Support('You owe the marketplace now', formatUsd(balanceDue)),
          ],
        ),
      );
}

class _Support extends StatelessWidget {
  const _Support(this.label, this.value);
  final String label, value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          Expanded(child: Text(label, style: const TextStyle(color: Colors.white70))),
          Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        ]),
      );
}

class _Attention extends StatelessWidget {
  const _Attention(this.a);
  final Attention a;

  @override
  Widget build(BuildContext context) {
    // (label, count, tone, route). Orders and products have no screen yet, so no route.
    final tiles = <(String, int, Color, String?)>[
      ('Orders to confirm', a.ordersToConfirm, AppTheme.warning, null),
      ('Orders to pack', a.ordersToPack, AppTheme.warning, null),
      ('Orders to ship', a.ordersToShip, AppTheme.warning, null),
      ('Return requests', a.returnRequests, AppTheme.danger, '/more/returns'),
      ('Refunds to send', a.refundsToSend, AppTheme.danger, '/more/refunds'),
      ('Paid requests', a.paymentClaims, AppTheme.info, '/more/payment-claims'),
      ('Price offers', a.offersWaiting, AppTheme.info, '/more/offers'),
      ('Questions', a.questionsToAnswer, AppTheme.info, '/more/questions'),
      ('Reviews to answer', a.reviewsUnanswered, AppTheme.info, '/more/reviews'),
      ('Out of stock', a.outOfStockSkus, AppTheme.danger, null),
      ('Low stock (${a.lowStockAt} or fewer)', a.lowStockSkus, AppTheme.warning, null),
      ('Products awaiting review', a.productsPending, AppTheme.neutral, null),
    ];
    final open = tiles.where((t) => t.$2 > 0).toList();
    return _Panel(
      title: 'Needs your attention',
      child: open.isEmpty
          ? const Row(children: [
              Icon(Icons.check_circle, color: AppTheme.success),
              SizedBox(width: AppSpacing.s),
              Text('All caught up.'),
            ])
          : Column(children: [
              for (final t in open)
                InkWell(
                  onTap: t.$4 == null ? null : () => context.push(t.$4!),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Row(children: [
                      Container(
                        width: 40,
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: t.$3.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                        child: Text('${t.$2}', style: TextStyle(color: t.$3, fontWeight: FontWeight.w800, fontSize: 16)),
                      ),
                      const SizedBox(width: AppSpacing.m),
                      Expanded(child: Text(t.$1, style: const TextStyle(fontSize: 16))),
                      if (t.$4 != null) const Icon(Icons.chevron_right, color: AppTheme.neutral),
                    ]),
                  ),
                ),
            ]),
    );
  }
}

class _Orders extends StatelessWidget {
  const _Orders(this.t);
  final DashboardTotals t;

  @override
  Widget build(BuildContext context) => _Panel(
        title: 'Orders',
        child: Column(children: [
          _Row('Orders placed', '${t.placed}', change: t.changeOrders),
          _Row('Paid orders', '${t.paid}', change: t.changePaidOrders),
          _Row('Average order', formatUsd(t.averageOrder), change: t.changeAverage),
          _Row('Return rate', '${t.returnRate.toStringAsFixed(t.returnRate % 1 == 0 ? 0 : 1)}%', hint: 'Of paid orders'),
        ]),
      );
}

StatusTone _tone(String status) => switch (status) {
      'delivered' => StatusTone.success,
      'cancelled' => StatusTone.danger,
      'pending' => StatusTone.warning,
      _ => StatusTone.info,
    };

class _StatusList extends StatelessWidget {
  const _StatusList(this.rows);
  final List<StatusCount> rows;

  @override
  Widget build(BuildContext context) => Column(children: [
        for (final r in rows)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(children: [
              StatusBadge(label: r.status[0].toUpperCase() + r.status.substring(1), tone: _tone(r.status)),
              const Spacer(),
              Text('${r.count}', style: const TextStyle(fontWeight: FontWeight.w700)),
            ]),
          ),
      ]);
}

class _TopProducts extends StatelessWidget {
  const _TopProducts(this.rows);
  final List<TopProduct> rows;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const Text('No sales in this period.', style: TextStyle(color: AppTheme.neutral));
    return Column(children: [
      for (var i = 0; i < rows.length; i++)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(children: [
            Text('${i + 1}', style: const TextStyle(color: AppTheme.neutral, fontWeight: FontWeight.w700)),
            const SizedBox(width: AppSpacing.m),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(rows[i].name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                Text('${rows[i].units} sold', style: const TextStyle(color: AppTheme.neutral, fontSize: 13)),
              ]),
            ),
            Text(formatUsd(rows[i].revenue), style: const TextStyle(fontWeight: FontWeight.w700)),
          ]),
        ),
    ]);
  }
}

class _Products extends StatelessWidget {
  const _Products(this.p);
  final ProductCounts p;

  @override
  Widget build(BuildContext context) => _Panel(
        title: 'Your products',
        child: Column(children: [
          _Row('Total products', '${p.total}'),
          _Row('Visible to buyers', '${p.visible}'),
          if (p.locked > 0) _Row('Locked by admin', '${p.locked}'),
          _Row('Approved / pending / rejected', '${p.approved} / ${p.pending} / ${p.rejected}'),
          _Row('Active / inactive / suspended', '${p.active} / ${p.inactive} / ${p.suspended}'),
          _Row('Total SKUs', '${p.totalSkus}', hint: p.outOfStockSkus > 0 ? '${p.outOfStockSkus} out of stock' : 'All in stock'),
        ]),
      );
}

class _Wishlist extends StatelessWidget {
  const _Wishlist(this.d);
  final Dashboard d;

  @override
  Widget build(BuildContext context) => _Panel(
        title: 'Wishlist',
        child: d.wishlistSaves == 0
            ? const Text('Nobody has saved your products yet.', style: TextStyle(color: AppTheme.neutral))
            : Column(children: [
                _Row('Total saves', '${d.wishlistSaves}', hint: '${d.wishlistProducts} products saved'),
                for (final w in d.wishlistTop) _Row(w.name, '${w.saves}'),
              ]),
      );
}
