import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.s),
        child: Text(text, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
      );
}
