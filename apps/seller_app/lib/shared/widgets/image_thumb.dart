import '../../core/config/app_config.dart';
import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// A small square picture with a placeholder when there is none.
class ImageThumb extends StatelessWidget {
  const ImageThumb(this.url, {super.key, this.size = 56});
  final String? url;
  final double size;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Container(
          width: size,
          height: size,
          color: AppTheme.border,
          child: url == null
              ? const Icon(Icons.image_outlined, color: AppTheme.neutral)
              : Image.network(AppConfig.mediaUrl(url!), fit: BoxFit.cover, errorBuilder: (_, _, _) => const Icon(Icons.image_not_supported_outlined, color: AppTheme.neutral)),
        ),
      );
}
