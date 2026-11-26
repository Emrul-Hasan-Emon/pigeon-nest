import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/catalogue_plate.dart';

class CategoryTile extends StatelessWidget {
  const CategoryTile({super.key, required this.name, required this.slug, required this.imageUrl});
  final String name;
  final String slug;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/categories/$slug'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CataloguePlate(
            aspectRatio: 1,
            child: imageUrl != null
                ? Image.network(imageUrl!, fit: BoxFit.cover)
                : Container(color: AppTheme.dove, child: const Icon(Icons.pets_outlined, color: AppTheme.slate)),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleSmall),
        ],
      ),
    );
  }
}

class CollectionTile extends StatelessWidget {
  const CollectionTile({super.key, required this.name, required this.slug, required this.imageUrl, this.colorCode});
  final String name;
  final String slug;
  final String? imageUrl;
  final String? colorCode;

  Color? get _accent {
    if (colorCode == null) return null;
    final hex = colorCode!.replaceFirst('#', '');
    final value = int.tryParse(hex.length == 6 ? 'FF$hex' : hex, radix: 16);
    return value == null ? null : Color(value);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/collections/$slug'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CataloguePlate(
            aspectRatio: 1.3,
            child: imageUrl != null
                ? Image.network(imageUrl!, fit: BoxFit.cover)
                : Container(color: _accent ?? AppTheme.dove),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleSmall),
        ],
      ),
    );
  }
}

class SellerTile extends StatelessWidget {
  const SellerTile({super.key, required this.id, required this.name, required this.avatarUrl});
  final int id;
  final String name;
  final String? avatarUrl;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/sellers/$id'),
      child: Column(
        children: [
          CircleAvatar(
            radius: 32,
            backgroundColor: AppTheme.dove,
            backgroundImage: avatarUrl != null ? NetworkImage(avatarUrl!) : null,
            child: avatarUrl == null ? Text(name.isEmpty ? '?' : name[0].toUpperCase()) : null,
          ),
          const SizedBox(height: AppSpacing.xs),
          SizedBox(width: 72, child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: Theme.of(context).textTheme.labelMedium)),
        ],
      ),
    );
  }
}
