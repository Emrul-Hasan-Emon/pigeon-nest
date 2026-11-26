import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// The one photo treatment across the app: a hairline-framed mat around the
/// picture, matching the website's `.store-plate` — sharp corners, no soft
/// drop shadow. Depth comes from the hairline and the paper-tone shift, not
/// blur. [child] is usually a product/listing photo at a fixed aspect ratio.
class CataloguePlate extends StatelessWidget {
  const CataloguePlate({super.key, required this.child, this.aspectRatio = 1});

  final Widget child;
  final double aspectRatio;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppTheme.paper,
        border: Border.all(color: AppTheme.line),
        borderRadius: BorderRadius.circular(8),
        boxShadow: [BoxShadow(color: AppTheme.ink.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: AspectRatio(aspectRatio: aspectRatio, child: child),
      ),
    );
  }
}
