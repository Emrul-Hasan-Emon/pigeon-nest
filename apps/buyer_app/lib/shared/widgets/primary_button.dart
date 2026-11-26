import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// The one filled button style (pill, ink, 52pt tall) — matches the
/// website's `bg-st-ink` buttons, with a soft lift so it reads as the
/// primary action on the screen.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({super.key, required this.label, required this.onPressed, this.busy = false});

  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        boxShadow: onPressed == null
            ? const []
            : [BoxShadow(color: AppTheme.ink.withValues(alpha: 0.22), blurRadius: 14, offset: const Offset(0, 6))],
      ),
      child: FilledButton(
        onPressed: busy ? null : onPressed,
        child: busy
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              )
            : Text(label),
      ),
    );
  }
}
