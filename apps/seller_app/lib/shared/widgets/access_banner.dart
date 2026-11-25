import 'package:flutter/material.dart';

import '../../core/auth/seller_access.dart';
import '../../core/theme/app_theme.dart';

/// Explains why a seller's shop is limited right now (awaiting approval,
/// rejected, suspended, or selling turned off/"shop closed"). Shown at the
/// top of the home screen; nothing is shown once the seller can fully manage
/// their shop ([SellerAccess.canManage]).
class AccessBanner extends StatelessWidget {
  const AccessBanner({super.key, required this.access});

  final SellerAccess access;

  (IconData, Color) get _look => switch (access.code) {
        'SELLER_PENDING' => (Icons.hourglass_top, AppTheme.warning),
        'SELLER_REJECTED' => (Icons.cancel_outlined, AppTheme.danger),
        'SELLER_SUSPENDED' => (Icons.block, AppTheme.danger),
        'SELLER_INACTIVE' => (Icons.storefront_outlined, AppTheme.neutral),
        _ => (Icons.info_outline, AppTheme.info),
      };

  String get _title => switch (access.code) {
        'SELLER_PENDING' => 'Awaiting approval',
        'SELLER_REJECTED' => 'Registration rejected',
        'SELLER_SUSPENDED' => 'Account suspended',
        'SELLER_INACTIVE' => 'Shop closed',
        _ => 'Limited access',
      };

  @override
  Widget build(BuildContext context) {
    if (access.canManage || access.reason == null) return const SizedBox.shrink();
    final (icon, color) = _look;
    return Container(
      margin: const EdgeInsets.fromLTRB(AppSpacing.m, AppSpacing.m, AppSpacing.m, 0),
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color),
          const SizedBox(width: AppSpacing.s),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_title, style: TextStyle(color: color, fontWeight: FontWeight.w700)),
                const SizedBox(height: AppSpacing.xs),
                Text(access.reason!, style: const TextStyle(color: AppTheme.ink)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
