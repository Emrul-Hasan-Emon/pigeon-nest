import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/image_thumb.dart';
import '../../../shared/widgets/loading_view.dart';
import '../data/wishlist_api.dart';

class WishlistScreen extends ConsumerStatefulWidget {
  const WishlistScreen({super.key});

  @override
  ConsumerState<WishlistScreen> createState() => _WishlistScreenState();
}

class _WishlistScreenState extends ConsumerState<WishlistScreen> {
  String _search = '';
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Widget _tile(String value, String label) => Expanded(
        child: AppCard(child: Column(children: [Text(value, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)), Text(label, textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.neutral, fontSize: 12))])),
      );

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(wishlistInsightsProvider(_search));
    return Scaffold(
      appBar: AppBar(title: const Text('Wishlist insights')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(AppSpacing.m),
          child: TextField(
            decoration: const InputDecoration(hintText: 'Search your products', prefixIcon: Icon(Icons.search)),
            onChanged: (v) {
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 500), () => setState(() => _search = v));
            },
          ),
        ),
        Expanded(
          child: data.when(
            loading: () => const LoadingView(),
            error: (e, _) => ErrorView(message: ApiException.from(e).message, onRetry: () => ref.invalidate(wishlistInsightsProvider(_search))),
            data: (w) => RefreshIndicator(
              onRefresh: () => ref.refresh(wishlistInsightsProvider(_search).future).then((_) {}),
              child: ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.fromLTRB(AppSpacing.m, 0, AppSpacing.m, AppSpacing.m), children: [
                Row(children: [_tile('${w.totalSaves}', 'Times saved'), const SizedBox(width: AppSpacing.s), _tile('${w.productsSaved} of ${w.products}', 'Products saved')]),
                const SizedBox(height: AppSpacing.m),
                const Text('Most saved', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
                const SizedBox(height: AppSpacing.s),
                if (w.top.isEmpty) const SizedBox(height: 200, child: EmptyView(message: 'Nobody has saved your products yet.', icon: Icons.favorite_border)),
                for (final p in w.top)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.s),
                    child: AppCard(
                      child: Row(children: [
                        ImageThumb(p.thumbnailUrl, size: 56),
                        const SizedBox(width: AppSpacing.m),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(p.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)), if (p.categoryName != null) Text(p.categoryName!, style: const TextStyle(color: AppTheme.neutral, fontSize: 12))])),
                        Row(children: [const Icon(Icons.favorite, size: 18, color: AppTheme.danger), const SizedBox(width: 4), Text('${p.saves}', style: const TextStyle(fontWeight: FontWeight.w800))]),
                      ]),
                    ),
                  ),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}
