import '../../../shared/state/list_refresh.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/format/money.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/product_models.dart';
import '../data/product_api.dart';
import 'products_screen.dart';
import '../../../shared/widgets/image_thumb.dart';
import '../../../shared/widgets/section_title.dart';
import '../../../shared/format/text.dart';

class ProductDetailScreen extends ConsumerWidget {
  const ProductDetailScreen({super.key, required this.productId});
  final int productId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(productDetailProvider(productId));
    return Scaffold(
      appBar: AppBar(
        title: Text(data.value?.row.name ?? 'Product', overflow: TextOverflow.ellipsis),
        actions: [
          if (data.value != null && !data.value!.row.locked)
            IconButton(
              tooltip: 'Edit',
              icon: const Icon(Icons.edit_outlined),
              onPressed: () async {
                await context.push('/products/$productId/edit');
                ref.invalidate(productDetailProvider(productId));
              },
            ),
        ],
      ),
      body: data.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: ApiException.from(e).message, onRetry: () => ref.invalidate(productDetailProvider(productId))),
        data: (p) => RefreshIndicator(
          onRefresh: () => ref.refresh(productDetailProvider(productId).future).then((_) {}),
          child: _Body(product: p),
        ),
      ),
    );
  }
}

class _Body extends ConsumerStatefulWidget {
  const _Body({required this.product});
  final ProductDetail product;

  @override
  ConsumerState<_Body> createState() => _BodyState();
}

class _BodyState extends ConsumerState<_Body> {
  bool _busy = false;
  ProductDetail get p => widget.product;

  void _say(String t) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t)));

  Future<void> _toggle() async {
    setState(() => _busy = true);
    try {
      await ref.read(productRepositoryProvider).setActive(p.row.id, !p.row.isActive);
      ref.invalidate(productDetailProvider(p.row.id));
      ref.read(listRefreshProvider('products').notifier).bump();
    } on ApiException catch (e) {
      if (mounted) _say(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _copy() async {
    setState(() => _busy = true);
    try {
      final id = await ref.read(productRepositoryProvider).copy(p.row.id);
      ref.read(listRefreshProvider('products').notifier).bump();
      if (!mounted) return;
      _say('Copied. It is switched off until you turn it on.');
      context.pushReplacement('/products/$id/edit');
    } on ApiException catch (e) {
      if (mounted) _say(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final row = p.row;
    final history = ref.watch(productHistoryProvider(row.id));
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(AppSpacing.m),
      children: [
        if (row.locked)
          Container(
            margin: const EdgeInsets.only(bottom: AppSpacing.m),
            padding: const EdgeInsets.all(AppSpacing.m),
            decoration: BoxDecoration(color: AppTheme.danger.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(row.status == 'rejected' ? 'Rejected' : 'Suspended', style: const TextStyle(color: AppTheme.danger, fontWeight: FontWeight.w700)),
              Text(p.lockReason ?? 'An admin locked this product. You cannot change it, but you can copy it.'),
            ]),
          ),
        Row(children: [
          ImageThumb(row.thumbnailUrl, size: 88),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(row.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
              const SizedBox(height: AppSpacing.xs),
              Wrap(spacing: AppSpacing.xs, runSpacing: AppSpacing.xs, children: [
                StatusBadge(label: productStatusLabel(row.status), tone: reviewTone(row.status)),
                StatusBadge(label: productStatusLabel(row.activeStatus), tone: activityTone(row.activeStatus)),
              ]),
              if (row.categoryName != null) Text(row.categoryName!, style: const TextStyle(color: AppTheme.neutral)),
            ]),
          ),
        ]),
        const SizedBox(height: AppSpacing.m),
        if (!row.locked) ...[
          FilledButton(onPressed: _busy ? null : _toggle, child: Text(row.isActive ? 'Switch off' : 'Switch on')),
          const SizedBox(height: AppSpacing.s),
          OutlinedButton.icon(
            onPressed: () async {
              await context.push('/products/${row.id}/pictures');
              ref.invalidate(productDetailProvider(row.id));
            },
            icon: const Icon(Icons.photo_library_outlined),
            label: const Text('Pictures'),
            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(52), foregroundColor: AppTheme.ink),
          ),
          const SizedBox(height: AppSpacing.s),
        ],
        OutlinedButton.icon(
          onPressed: _busy ? null : _copy,
          icon: const Icon(Icons.copy_outlined),
          label: const Text('Copy this product'),
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(52), foregroundColor: AppTheme.ink),
        ),
        const SizedBox(height: AppSpacing.m),
        if (p.media.isNotEmpty)
          SizedBox(
            height: 80,
            child: ListView(scrollDirection: Axis.horizontal, children: [
              for (final m in p.media.where((m) => m.isImage)) Padding(padding: const EdgeInsets.only(right: AppSpacing.s), child: ImageThumb(m.url, size: 80)),
            ]),
          ),
        if (p.description != null) ...[
          const SizedBox(height: AppSpacing.m),
          AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const SectionTitle('Description'), Text(p.description!)])),
        ],
        if (p.hasBirdFacts) ...[
          const SizedBox(height: AppSpacing.m),
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const SectionTitle('About the birds'),
              for (final (label, v) in [('Breed', row.breed), ('Bloodline', p.bloodline), ('Bloodline note', p.bloodlineNote), ('Vaccination', p.vaccinationNote), ('Health', p.healthNote), ('Race record', p.raceRecord)])
                if (v != null) Padding(padding: const EdgeInsets.symmetric(vertical: 2), child: Text.rich(TextSpan(children: [TextSpan(text: '$label: ', style: const TextStyle(fontWeight: FontWeight.w600)), TextSpan(text: v)]))),
            ]),
          ),
        ],
        const SizedBox(height: AppSpacing.m),
        const SectionTitle('Options you sell'),
        for (final s in p.skus) Padding(padding: const EdgeInsets.only(bottom: AppSpacing.s), child: _SkuCard(s)),
        const SizedBox(height: AppSpacing.m),
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SectionTitle('Status history'),
            history.when(
              loading: () => const Padding(padding: EdgeInsets.all(8), child: Center(child: CircularProgressIndicator())),
              error: (e, _) => Text(ApiException.from(e).message),
              data: (lines) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (lines.isEmpty) const Text('Nothing yet.', style: TextStyle(color: AppTheme.neutral)),
                for (final h in lines)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${statusLabel(h.action)}: ${productStatusLabel(h.toStatus)}, ${h.toActiveStatus}', style: const TextStyle(fontWeight: FontWeight.w600)),
                      if (h.reason != null) Text(h.reason!),
                      Text('${h.by ?? ''} · ${formatDateTime(h.at)}', style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
                    ]),
                  ),
              ]),
            ),
          ]),
        ),
        const SizedBox(height: AppSpacing.xl),
      ],
    );
  }
}

class _SkuCard extends StatelessWidget {
  const _SkuCard(this.s);
  final Sku s;

  @override
  Widget build(BuildContext context) {
    final age = ageText(s.hatchDate);
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(s.label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16))),
          if (s.isDefault) const StatusBadge(label: 'Default', tone: StatusTone.info),
          if (!s.isActive) const Padding(padding: EdgeInsets.only(left: 4), child: StatusBadge(label: 'Off', tone: StatusTone.neutral)),
        ]),
        if (s.code != null) Text('Code: ${s.code}', style: const TextStyle(color: AppTheme.neutral, fontSize: 13)),
        const SizedBox(height: AppSpacing.xs),
        Row(children: [
          Text(formatUsd(s.payable), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
          if (s.onOffer) ...[const SizedBox(width: 8), Text(formatUsd(s.price), style: const TextStyle(decoration: TextDecoration.lineThrough, color: AppTheme.neutral))],
          const Spacer(),
          Text('${s.quantity} in stock', style: TextStyle(color: s.quantity == 0 ? AppTheme.danger : (s.quantity <= s.lowStockThreshold ? AppTheme.warning : AppTheme.neutral), fontWeight: FontWeight.w600)),
        ]),
        if (s.acceptProposals) const Text('Takes price offers', style: TextStyle(color: AppTheme.neutral, fontSize: 13)),
        if (s.ringNumber != null || s.hatchDate != null || s.vaccineName != null || s.parents.isNotEmpty) ...[
          const Divider(),
          if (s.ringNumber != null) Text('Ring: ${s.ringNumber}'),
          if (s.hatchDate != null) Text('Hatched: ${s.hatchDate}${age.isEmpty ? '' : ' ($age)'}'),
          if (s.vaccineName != null) Text('Vaccine: ${s.vaccineName}${s.vaccinatedOn == null ? '' : ', ${s.vaccinatedOn}'}'),
          for (final role in const ['sire', 'dam'])
            if (s.parent(role) != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Row(children: [
                  ImageThumb(s.parent(role)!.imageUrl, size: 40),
                  const SizedBox(width: AppSpacing.s),
                  Text('${role == 'sire' ? 'Father' : 'Mother'}: ${[s.parent(role)!.name, s.parent(role)!.ringNumber].whereType<String>().join(' · ')}'),
                ]),
              ),
        ],
      ]),
    );
  }
}
