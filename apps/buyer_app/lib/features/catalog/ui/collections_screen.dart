import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../data/storefront_api.dart';
import '../data/storefront_models.dart';
import '../widgets/category_tile.dart';

final collectionsProvider = FutureProvider<List<StoreCollection>>((ref) async => (await ref.read(storefrontApiProvider).collections(1)).results);

class CollectionsScreen extends ConsumerWidget {
  const CollectionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(collectionsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Collections')),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: 'Could not load collections.', onRetry: () => ref.invalidate(collectionsProvider)),
        data: (collections) => GridView.builder(
          padding: const EdgeInsets.all(AppSpacing.m),
          itemCount: collections.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: AppSpacing.m, crossAxisSpacing: AppSpacing.m, childAspectRatio: 1.05),
          itemBuilder: (_, i) => CollectionTile(name: collections[i].name, slug: collections[i].slug, imageUrl: collections[i].imageUrl, colorCode: collections[i].colorCode),
        ),
      ),
    );
  }
}
