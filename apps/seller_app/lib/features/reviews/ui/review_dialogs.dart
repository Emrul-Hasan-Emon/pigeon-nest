import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../data/review_models.dart';

/// A box to type a reply (or edit one). Returns the text, or null when the seller backs out.
Future<String?> askText(BuildContext context, {required String title, String initial = '', String action = 'Send'}) {
  final text = TextEditingController(text: initial);
  String? error;
  return showDialog<String>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, set) => AlertDialog(
        title: Text(title),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: text, maxLines: 4, maxLength: 1000, decoration: const InputDecoration(labelText: 'Your reply')),
          if (error != null) Text(error!, style: const TextStyle(color: AppTheme.danger)),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Back')),
          FilledButton(
            onPressed: () => text.text.trim().isEmpty ? set(() => error = 'Write something first.') : Navigator.pop(ctx, text.text),
            style: FilledButton.styleFrom(minimumSize: const Size(110, 48)),
            child: Text(action),
          ),
        ],
      ),
    ),
  );
}

/// Pick why a review or reply is being reported. Returns (reason, note), or null when the seller backs out.
Future<(String, String)?> askReport(BuildContext context) {
  var reason = 'spam';
  final note = TextEditingController();
  return showDialog<(String, String)>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, set) => AlertDialog(
        title: const Text('Report this'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('A moderator decides. You cannot hide it yourself.'),
          RadioGroup<String>(
            groupValue: reason,
            onChanged: (v) => set(() => reason = v ?? reason),
            child: Column(children: [for (final e in reportReasons.entries) RadioListTile<String>(dense: true, contentPadding: EdgeInsets.zero, value: e.key, title: Text(e.value))]),
          ),
          TextField(controller: note, maxLength: 500, decoration: const InputDecoration(labelText: 'Note (optional)')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Back')),
          FilledButton(onPressed: () => Navigator.pop(ctx, (reason, note.text)), style: FilledButton.styleFrom(minimumSize: const Size(110, 48), backgroundColor: AppTheme.danger), child: const Text('Report')),
        ],
      ),
    ),
  );
}
