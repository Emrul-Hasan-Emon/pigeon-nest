import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../catalog/data/storefront_api.dart';
import '../../catalog/data/storefront_models.dart';
import '../../catalog/widgets/category_tile.dart';
import '../../catalog/widgets/product_tile.dart';

final homepageProvider = FutureProvider<StoreHomepage>((ref) => ref.read(storefrontApiProvider).homepage());

/// Home tab: hero banners, then every live section in the order the admin set.
class HomepageScreen extends ConsumerWidget {
  const HomepageScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(homepageProvider);
    return async.when(
      loading: () => const LoadingView(),
      error: (e, _) => ErrorView(message: 'Could not load the homepage.', onRetry: () => ref.invalidate(homepageProvider)),
      data: (home) => RefreshIndicator(
        onRefresh: () async => ref.invalidate(homepageProvider),
        child: ListView(
          padding: const EdgeInsets.only(bottom: AppSpacing.xl),
          children: [
            for (final section in home.sections) _Section(section: section),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.section});
  final HomepageSection section;

  @override
  Widget build(BuildContext context) {
    if (section.sectionType == 'banners') return _HeroCarousel(items: section.items);

    final title = Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.m, AppSpacing.l, AppSpacing.m, AppSpacing.s),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(section.title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Container(width: 28, height: 2.5, color: AppTheme.brass),
        ],
      ),
    );

    if (section.sectionType == 'sellers') {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          title,
          SizedBox(
            height: 108,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
              itemCount: section.items.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.m),
              itemBuilder: (_, i) {
                final s = section.items[i];
                return SellerTile(id: s['id'] as int, name: s['name'] as String, avatarUrl: s['avatarUrl'] as String?);
              },
            ),
          ),
        ],
      );
    }

    if (section.sectionType == 'categories') {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          title,
          SizedBox(
            height: 140,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
              itemCount: section.items.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.m),
              itemBuilder: (_, i) {
                final c = section.items[i];
                return SizedBox(width: 96, child: CategoryTile(name: c['name'] as String, slug: c['slug'] as String, imageUrl: c['imageUrl'] as String?));
              },
            ),
          ),
        ],
      );
    }

    if (section.sectionType == 'specific_collections') {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          title,
          SizedBox(
            height: 150,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
              itemCount: section.items.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.m),
              itemBuilder: (_, i) {
                final c = section.items[i];
                return SizedBox(
                  width: 130,
                  child: CollectionTile(name: c['name'] as String, slug: c['slug'] as String, imageUrl: c['imageUrl'] as String?, colorCode: c['colorCode'] as String?),
                );
              },
            ),
          ),
        ],
      );
    }

    if (kProductSectionTypes.contains(section.sectionType)) {
      final products = section.items.map(StoreProduct.fromJson).toList();
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          title,
          SizedBox(
            height: 230,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
              itemCount: products.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.m),
              itemBuilder: (_, i) => SizedBox(width: 150, child: ProductTile(product: products[i], lot: i + 1)),
            ),
          ),
        ],
      );
    }

    return const SizedBox.shrink();
  }
}

class _HeroCarousel extends StatefulWidget {
  const _HeroCarousel({required this.items});
  final List<Map<String, dynamic>> items;

  @override
  State<_HeroCarousel> createState() => _HeroCarouselState();
}

class _HeroCarouselState extends State<_HeroCarousel> {
  final _controller = PageController();
  Timer? _timer;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    if (widget.items.length > 1) {
      _timer = Timer.periodic(const Duration(seconds: 5), (_) {
        if (!mounted) return;
        _page = (_page + 1) % widget.items.length;
        _controller.animateToPage(_page, duration: const Duration(milliseconds: 400), curve: Curves.easeInOut);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.m, AppSpacing.m, AppSpacing.m, 0),
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: Stack(
          children: [
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                boxShadow: [BoxShadow(color: AppTheme.ink.withValues(alpha: 0.12), blurRadius: 16, offset: const Offset(0, 6))],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: PageView.builder(
                  controller: _controller,
                  onPageChanged: (i) => setState(() => _page = i),
                  itemCount: widget.items.length,
                  itemBuilder: (_, i) {
                    final b = widget.items[i];
                    final imageUrl = b['imageUrl'] as String?;
                    return GestureDetector(
                      onTap: () {
                        final link = b['linkUrl'] as String?;
                        if (link != null && link.startsWith('/')) context.push(link);
                      },
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          imageUrl != null
                              ? Image.network(imageUrl, fit: BoxFit.cover, width: double.infinity)
                              : Container(color: AppTheme.ink, child: Center(child: Text(b['title'] as String, style: const TextStyle(color: AppTheme.dove)))),
                          if (imageUrl != null)
                            DecoratedBox(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [Colors.transparent, AppTheme.ink.withValues(alpha: 0.38)],
                                  stops: const [0.5, 1],
                                ),
                              ),
                            ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ),
            if (widget.items.length > 1)
              Positioned(
                bottom: 10,
                left: 0,
                right: 0,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (var i = 0; i < widget.items.length; i++)
                      Container(
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        width: i == _page ? 16 : 6,
                        height: 6,
                        decoration: BoxDecoration(color: Colors.white.withValues(alpha: i == _page ? 0.95 : 0.55), borderRadius: BorderRadius.circular(3)),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
