import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../data/storefront_api.dart';
import '../data/storefront_models.dart';
import '../widgets/category_tile.dart';
import 'product_list_screen.dart';

final categoryDetailProvider = FutureProvider.family<StoreCategoryDetail, String>((ref, slug) => ref.read(storefrontApiProvider).category(slug));

class CategoryDetailScreen extends ConsumerWidget {
  const CategoryDetailScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(categoryDetailProvider(slug));
    return Scaffold(
      appBar: AppBar(title: Text(async.asData?.value.name ?? 'Category')),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: 'Could not load this category.', onRetry: () => ref.invalidate(categoryDetailProvider(slug))),
        data: (category) => ProductListScreen(
          query: ProductQuery(categoryId: category.id),
          emptyText: 'No birds in this category yet.',
          header: _Header(category: category),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.category});
  final StoreCategoryDetail category;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (category.breadcrumb.length > 1)
          Padding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.m, AppSpacing.m, AppSpacing.m, 0),
            child: Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                for (var i = 0; i < category.breadcrumb.length; i++) ...[
                  if (i > 0) const Padding(padding: EdgeInsets.symmetric(horizontal: 4), child: Icon(Icons.chevron_right, size: 16, color: AppTheme.slate)),
                  GestureDetector(
                    onTap: () => context.push('/categories/${category.breadcrumb[i].slug}'),
                    child: Text(category.breadcrumb[i].name, style: const TextStyle(color: AppTheme.slate, fontSize: 12)),
                  ),
                ],
              ],
            ),
          ),
        if (category.description != null) Padding(padding: const EdgeInsets.all(AppSpacing.m), child: Text(category.description!)),
        if (category.children.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.m, AppSpacing.m, AppSpacing.m, AppSpacing.s),
            child: Text('Subcategories', style: Theme.of(context).textTheme.titleMedium),
          ),
          SizedBox(
            height: 120,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
              itemCount: category.children.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.m),
              itemBuilder: (_, i) => SizedBox(width: 88, child: CategoryTile(name: category.children[i].name, slug: category.children[i].slug, imageUrl: category.children[i].imageUrl)),
            ),
          ),
        ],
        Padding(
          padding: const EdgeInsets.fromLTRB(AppSpacing.m, AppSpacing.m, AppSpacing.m, 0),
          child: Text('Birds', style: Theme.of(context).textTheme.titleMedium),
        ),
      ],
    );
  }
}
