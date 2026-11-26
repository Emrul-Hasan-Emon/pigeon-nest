import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/app_theme.dart';
import '../state/wishlist_ids_controller.dart';

/// The heart used everywhere a product can be saved: a tile, the detail page.
/// Asks for a sign-in the first time a guest taps it.
class WishlistHeart extends ConsumerWidget {
  const WishlistHeart({super.key, required this.productId, this.size = 20});
  final int productId;
  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final saved = ref.watch(wishlistIdsProvider).asData?.value.contains(productId) ?? false;
    return GestureDetector(
      onTap: () {
        if (ref.read(authProvider).status != AuthStatus.signedIn) {
          context.push('/login');
          return;
        }
        ref.read(wishlistIdsProvider.notifier).toggle(productId);
      },
      child: Container(
        padding: const EdgeInsets.all(5),
        decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
        child: Icon(saved ? Icons.favorite : Icons.favorite_border, size: size, color: saved ? AppTheme.danger : AppTheme.slate),
      ),
    );
  }
}
