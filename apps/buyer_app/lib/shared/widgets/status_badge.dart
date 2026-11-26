import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// What a status badge means, so every screen picks a colour the same way
/// instead of choosing one per feature (delivered is always [success], etc.).
enum StatusTone { success, warning, danger, info, neutral }

/// A small coloured pill for an order/payment/return status word.
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.label, required this.tone});

  final String label;
  final StatusTone tone;

  Color get _color => switch (tone) {
        StatusTone.success => AppTheme.success,
        StatusTone.warning => AppTheme.warning,
        StatusTone.danger => AppTheme.danger,
        StatusTone.info => AppTheme.teal,
        StatusTone.neutral => AppTheme.slate,
      };

  @override
  Widget build(BuildContext context) {
    final color = _color;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s, vertical: AppSpacing.xs),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 13)),
    );
  }
}
