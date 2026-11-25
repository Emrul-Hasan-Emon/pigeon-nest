import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// The one card look: a hairline border, no shadow, consistent padding.
/// Used for every grouped block (a dashboard tile, a list row, a form section).
class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.padding = const EdgeInsets.all(AppSpacing.m), this.onTap});

  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppTheme.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: child,
    );
    if (onTap == null) return card;
    return InkWell(borderRadius: BorderRadius.circular(12), onTap: onTap, child: card);
  }
}
