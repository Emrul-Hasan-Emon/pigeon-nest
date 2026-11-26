import '../../core/config/app_config.dart';
import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../models/attachment.dart';
import 'image_thumb.dart';

/// Proof pictures and files. A picture opens full screen; other files show their name.
class AttachmentStrip extends StatelessWidget {
  const AttachmentStrip(this.items, {super.key});
  final List<Attachment> items;

  @override
  Widget build(BuildContext context) => Wrap(spacing: AppSpacing.s, runSpacing: AppSpacing.s, children: [
        for (final a in items)
          a.isImage
              ? InkWell(
                  onTap: () => showDialog<void>(context: context, builder: (_) => Dialog(child: InteractiveViewer(child: Image.network(AppConfig.mediaUrl(a.url))))),
                  child: ImageThumb(a.url, size: 64),
                )
              : Chip(avatar: const Icon(Icons.attach_file, size: 16), label: Text(a.fileName, overflow: TextOverflow.ellipsis)),
      ]);
}
