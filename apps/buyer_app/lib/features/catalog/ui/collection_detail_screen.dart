import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../data/storefront_api.dart';
import '../data/storefront_models.dart';
import 'product_list_screen.dart';

final collectionDetailProvider = FutureProvider.family<StoreCollectionDetail, String>((ref, slug) => ref.read(storefrontApiProvider).collection(slug));

class CollectionDetailScreen extends ConsumerWidget {
  const CollectionDetailScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(collectionDetailProvider(slug));
    return Scaffold(
      appBar: AppBar(title: Text(async.asData?.value.name ?? 'Collection')),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: 'Could not load this collection.', onRetry: () => ref.invalidate(collectionDetailProvider(slug))),
        data: (collection) => ProductListScreen(
          query: ProductQuery(collectionId: collection.id),
          emptyText: 'No birds in this collection yet.',
          header: collection.description == null
              ? null
              : Padding(padding: const EdgeInsets.all(AppSpacing.m), child: Text(collection.description!)),
        ),
      ),
    );
  }
}
