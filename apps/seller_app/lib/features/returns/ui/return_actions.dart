import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/photo_picker_row.dart';

/// What the seller typed into a return step.
class StepInput {
  StepInput(this.note, this.includeDelivery, this.files);
  final String note;
  final bool? includeDelivery;
  final List<XFile> files;
}

/// Asks for the note (and, where needed, the delivery choice and proof) of one return step.
/// Returns null when the seller backs out.
Future<StepInput?> askReturnStep(
  BuildContext context, {
  required String title,
  required String action,
  bool noteRequired = false,
  bool askDelivery = false,
  bool deliveryDefault = true,
  bool askFiles = false,
  bool danger = false,
}) {
  final note = TextEditingController();
  var includeDelivery = deliveryDefault;
  var files = <XFile>[];
  String? error;
  return showDialog<StepInput>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, set) => AlertDialog(
        title: Text(title),
        content: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            TextField(controller: note, maxLines: 3, maxLength: 2000, decoration: InputDecoration(labelText: noteRequired ? 'Note (required)' : 'Note (optional)')),
            if (askDelivery) SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Refund the delivery charge too'), value: includeDelivery, onChanged: (v) => set(() => includeDelivery = v)),
            if (askFiles) ...[const SizedBox(height: AppSpacing.s), const Text('Proof of the refund (optional)'), const SizedBox(height: AppSpacing.xs), PhotoPickerRow(files: files, onChanged: (f) => set(() => files = f))],
            if (error != null) Text(error!, style: const TextStyle(color: AppTheme.danger)),
          ]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Back')),
          FilledButton(
            onPressed: () {
              if (noteRequired && note.text.trim().length < 3) return set(() => error = 'Write at least 3 characters.');
              Navigator.pop(ctx, StepInput(note.text, askDelivery ? includeDelivery : null, files));
            },
            style: FilledButton.styleFrom(minimumSize: const Size(110, 48), backgroundColor: danger ? AppTheme.danger : null),
            child: Text(action),
          ),
        ],
      ),
    ),
  );
}
