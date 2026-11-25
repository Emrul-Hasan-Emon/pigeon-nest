import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/theme/app_theme.dart';
import '../media/image_picker_helper.dart';

/// Picked pictures with a remove button each and an add tile (proof for a payment, a refund, an update).
class PhotoPickerRow extends StatelessWidget {
  const PhotoPickerRow({super.key, required this.files, required this.onChanged, this.max = 10});
  final List<XFile> files;
  final ValueChanged<List<XFile>> onChanged;
  final int max;

  Future<void> _add() async {
    final picked = await ImagePickerHelper.pickMultipleFromGallery(limit: max - files.length);
    onChanged([...files, ...picked.take(max - files.length)]);
  }

  @override
  Widget build(BuildContext context) => Wrap(spacing: AppSpacing.s, runSpacing: AppSpacing.s, children: [
        for (var i = 0; i < files.length; i++)
          Stack(children: [
            ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.file(File(files[i].path), width: 80, height: 80, fit: BoxFit.cover)),
            Positioned(
              right: 0,
              top: 0,
              child: InkWell(
                onTap: () => onChanged([...files]..removeAt(i)),
                child: const CircleAvatar(radius: 12, backgroundColor: Colors.black54, child: Icon(Icons.close, size: 14, color: Colors.white)),
              ),
            ),
          ]),
        if (files.length < max)
          InkWell(
            onTap: _add,
            child: Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(color: Colors.white, border: Border.all(color: AppTheme.border), borderRadius: BorderRadius.circular(8)),
              child: const Icon(Icons.add_a_photo_outlined, color: AppTheme.neutral),
            ),
          ),
      ]);
}
