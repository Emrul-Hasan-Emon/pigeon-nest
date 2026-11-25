import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import 'primary_button.dart';

/// A request failed (no internet, server error, ...). Always offers a retry,
/// since that is almost always what the seller wants to do next.
class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 56, color: AppTheme.danger),
            const SizedBox(height: AppSpacing.m),
            Text(message, textAlign: TextAlign.center),
            if (onRetry != null) ...[
              const SizedBox(height: AppSpacing.l),
              SizedBox(width: 160, child: PrimaryButton(label: 'Try again', onPressed: onRetry)),
            ],
          ],
        ),
      ),
    );
  }
}
