import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// A list that genuinely has nothing in it yet (no orders, no products, ...).
class EmptyView extends StatelessWidget {
  const EmptyView({super.key, required this.message, this.icon = Icons.inbox_outlined});

  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 56, color: AppTheme.neutral.withValues(alpha: 0.5)),
            const SizedBox(height: AppSpacing.m),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.neutral)),
          ],
        ),
      ),
    );
  }
}
