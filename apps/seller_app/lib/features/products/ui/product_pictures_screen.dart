import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/media/image_picker_helper.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../data/product_api.dart';
import '../../../shared/widgets/image_thumb.dart';
import '../../../shared/widgets/section_title.dart';

/// The main picture and the gallery. Every change is saved at once.
class ProductPicturesScreen extends ConsumerStatefulWidget {
  const ProductPicturesScreen({super.key, required this.productId});
  final int productId;

  @override
  ConsumerState<ProductPicturesScreen> createState() => _ProductPicturesScreenState();
}

class _ProductPicturesScreenState extends ConsumerState<ProductPicturesScreen> {
  bool _busy = false;

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
      ref.invalidate(productDetailProvider(widget.productId));
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool> _confirm(String text) async =>
      await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          content: Text(text),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), style: FilledButton.styleFrom(minimumSize: const Size(110, 48), backgroundColor: AppTheme.danger), child: const Text('Remove')),
          ],
        ),
      ) ??
      false;

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(productDetailProvider(widget.productId));
    final repo = ref.read(productRepositoryProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Pictures')),
      body: data.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: ApiException.from(e).message, onRetry: () => ref.invalidate(productDetailProvider(widget.productId))),
        data: (p) => ListView(
          padding: const EdgeInsets.all(AppSpacing.m),
          children: [
            if (_busy) const LinearProgressIndicator(),
            const SectionTitle('Main picture'),
            Row(children: [
              ImageThumb(p.row.thumbnailUrl, size: 120),
              const SizedBox(width: AppSpacing.m),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  OutlinedButton(
                    onPressed: _busy
                        ? null
                        : () async {
                            final f = await ImagePickerHelper.pickFromGallery();
                            if (f != null) await _run(() => repo.updateMedia(p.row.id, thumbnail: f));
                          },
                    child: Text(p.row.thumbnailUrl == null ? 'Add main picture' : 'Change'),
                  ),
                  if (p.row.thumbnailUrl != null)
                    TextButton(
                      onPressed: _busy ? null : () async => await _confirm('Remove the main picture?') ? _run(() => repo.updateMedia(p.row.id, removeThumbnail: true)) : null,
                      child: const Text('Remove', style: TextStyle(color: AppTheme.danger)),
                    ),
                ]),
              ),
            ]),
            const SizedBox(height: AppSpacing.l),
            const SectionTitle('Gallery'),
            Wrap(spacing: AppSpacing.s, runSpacing: AppSpacing.s, children: [
              for (final m in p.media)
                Stack(children: [
                  ImageThumb(m.isImage ? m.url : null, size: 96),
                  Positioned(
                    right: 0,
                    top: 0,
                    child: InkWell(
                      onTap: _busy ? null : () async => await _confirm('Remove this picture?') ? _run(() => repo.updateMedia(p.row.id, removeIds: [m.id])) : null,
                      child: const CircleAvatar(radius: 13, backgroundColor: Colors.black54, child: Icon(Icons.close, size: 15, color: Colors.white)),
                    ),
                  ),
                ]),
              if (p.media.length < 20)
                InkWell(
                  onTap: _busy
                      ? null
                      : () async {
                          final files = await ImagePickerHelper.pickMultipleFromGallery(limit: 20 - p.media.length);
                          if (files.isNotEmpty) await _run(() => repo.updateMedia(p.row.id, add: files));
                        },
                  child: Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(color: Colors.white, border: Border.all(color: AppTheme.border), borderRadius: BorderRadius.circular(8)),
                    child: const Icon(Icons.add_a_photo_outlined, color: AppTheme.neutral),
                  ),
                ),
            ]),
          ],
        ),
      ),
    );
  }
}
