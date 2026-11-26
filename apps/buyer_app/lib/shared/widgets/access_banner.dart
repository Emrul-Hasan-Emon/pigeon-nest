import 'package:flutter/material.dart';

import '../../core/auth/user_access.dart';
import '../../core/theme/app_theme.dart';

/// Shown above everything else once signed in while the account cannot be
/// used (suspended) — matches the website's `UserStatusBanner`. Hidden once
/// `access.canUse` is true.
class AccessBanner extends StatelessWidget {
  const AccessBanner({super.key, required this.access});

  final UserAccess access;

  @override
  Widget build(BuildContext context) {
    if (access.canUse) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.all(AppSpacing.m),
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: AppTheme.danger.withValues(alpha: 0.08),
        border: Border.all(color: AppTheme.danger.withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Account suspended', style: TextStyle(fontWeight: FontWeight.w700, color: AppTheme.danger)),
          if (access.reason != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(access.reason!, style: const TextStyle(color: AppTheme.ink)),
          ],
        ],
      ),
    );
  }
}
