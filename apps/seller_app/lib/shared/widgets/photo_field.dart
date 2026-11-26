import '../../core/config/app_config.dart';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/theme/app_theme.dart';
import '../media/image_picker_helper.dart';

/// One picture slot: shows the new pick, else the saved picture, else a prompt.
/// Tap to choose from the gallery; [onPicked] gets the file.
class PhotoField extends StatelessWidget {
  const PhotoField({super.key, required this.label, required this.picked, required this.onPicked, this.savedUrl, this.round = false});

  final String label;
  final XFile? picked;
  final String? savedUrl;
  final ValueChanged<XFile> onPicked;
  final bool round;

  Future<void> _pick() async {
    final file = await ImagePickerHelper.pickFromGallery();
    if (file != null) onPicked(file);
  }

  @override
  Widget build(BuildContext context) {
    final Widget image;
    if (picked != null) {
      image = Image.file(File(picked!.path), fit: BoxFit.cover);
    } else if (savedUrl != null) {
      image = Image.network(AppConfig.mediaUrl(savedUrl!), fit: BoxFit.cover, errorBuilder: (_, _, _) => const _Empty(text: 'Picture not available'));
    } else {
      image = const _Empty(text: 'Tap to add');
    }
    final shape = round ? BoxShape.circle : BoxShape.rectangle;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: AppSpacing.s),
        InkWell(
          onTap: _pick,
          borderRadius: BorderRadius.circular(round ? 999 : 12),
          child: Container(
            height: round ? 120 : 150,
            width: round ? 120 : double.infinity,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              shape: shape,
              color: Colors.white,
              border: Border.all(color: AppTheme.border),
              borderRadius: round ? null : BorderRadius.circular(12),
            ),
            child: image,
          ),
        ),
      ],
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.add_a_photo_outlined, color: AppTheme.neutral),
          const SizedBox(height: AppSpacing.xs),
          Text(text, style: const TextStyle(color: AppTheme.neutral, fontSize: 13)),
        ]),
      );
}
