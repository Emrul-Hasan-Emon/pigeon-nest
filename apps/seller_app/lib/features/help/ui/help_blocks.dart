import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../data/help_models.dart';

/// Draws one help block: numbered steps, a word list, bullet points, questions and answers, or a note.
class HelpBlockView extends StatelessWidget {
  const HelpBlockView(this.block, {super.key});
  final HelpBlock block;

  @override
  Widget build(BuildContext context) {
    if (block.type == 'note') return _note();
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.m),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (block.title != null) Padding(padding: const EdgeInsets.only(bottom: AppSpacing.s), child: Text(block.title!, style: const TextStyle(fontWeight: FontWeight.w700))),
        for (var i = 0; i < block.items.length; i++) _item(i, block.items[i]),
      ]),
    );
  }

  Widget _item(int i, (String, String?) item) {
    final (main, extra) = item;
    return switch (block.type) {
      'steps' => Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.s),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            CircleAvatar(radius: 13, backgroundColor: AppTheme.ink, child: Text('${i + 1}', style: const TextStyle(color: Colors.white, fontSize: 13))),
            const SizedBox(width: AppSpacing.s),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(main), if (extra != null) Text(extra, style: const TextStyle(color: AppTheme.neutral, fontSize: 13))])),
          ]),
        ),
      'words' => Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.s),
          child: Text.rich(TextSpan(children: [TextSpan(text: '$main: ', style: const TextStyle(fontWeight: FontWeight.w700)), TextSpan(text: extra ?? '')])),
        ),
      'faq' => Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.s),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(main, style: const TextStyle(fontWeight: FontWeight.w600)), if (extra != null) Text(extra)]),
        ),
      _ => Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.xs),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('•  '), Expanded(child: Text(main))]),
        ),
    };
  }

  Widget _note() {
    final warn = block.tone == 'warn';
    final color = warn ? AppTheme.warning : AppTheme.info;
    return Container(
      margin: const EdgeInsets.only(top: AppSpacing.m),
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(warn ? Icons.warning_amber_outlined : Icons.info_outline, color: color, size: 20),
        const SizedBox(width: AppSpacing.s),
        Expanded(child: Text(block.text ?? '')),
      ]),
    );
  }
}
