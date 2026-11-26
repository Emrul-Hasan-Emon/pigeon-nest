import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../data/storefront_api.dart';
import '../data/storefront_models.dart';
import '../widgets/category_tile.dart';

final categoryTreeProvider = FutureProvider<List<CategoryNode>>((ref) => ref.read(storefrontApiProvider).categoryTree());

/// Categories tab: the top-level category grid. Each one opens its own
/// detail screen, which shows its own children and products.
class CategoriesScreen extends ConsumerWidget {
  const CategoriesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(categoryTreeProvider);
    return async.when(
      loading: () => const LoadingView(),
      error: (e, _) => ErrorView(message: 'Could not load categories.', onRetry: () => ref.invalidate(categoryTreeProvider)),
      data: (categories) => GridView.builder(
        padding: const EdgeInsets.all(AppSpacing.m),
        itemCount: categories.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, mainAxisSpacing: AppSpacing.m, crossAxisSpacing: AppSpacing.m, childAspectRatio: 0.82),
        itemBuilder: (_, i) => CategoryTile(name: categories[i].name, slug: categories[i].slug, imageUrl: categories[i].imageUrl),
      ),
    );
  }
}
