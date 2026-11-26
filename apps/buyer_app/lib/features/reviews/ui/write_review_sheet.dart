import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/media/image_picker_helper.dart';
import '../../../shared/widgets/catalogue_plate.dart';
import '../../../shared/widgets/primary_button.dart';
import '../data/review_api.dart';
import '../data/review_models.dart';

/// Write a review on a delivered item, or edit one still inside its window.
/// Pass [orderItemId] to create one, or [existing] to edit it.
class WriteReviewSheet extends ConsumerStatefulWidget {
  const WriteReviewSheet({super.key, this.orderItemId, this.existing});
  final int? orderItemId;
  final MyReview? existing;

  @override
  ConsumerState<WriteReviewSheet> createState() => _WriteReviewSheetState();
}

class _WriteReviewSheetState extends ConsumerState<WriteReviewSheet> {
  late int _rating = widget.existing?.rating ?? 5;
  late final _title = TextEditingController(text: widget.existing?.title ?? '');
  late final _comment = TextEditingController(text: widget.existing?.comment ?? '');
  final _newImages = <XFile>[];
  bool _busy = false;
  String? _error;

  Future<void> _addPhoto() async {
    final files = await ImagePickerHelper.pickMultipleFromGallery(limit: 5 - _newImages.length);
    setState(() => _newImages.addAll(files));
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (widget.existing != null) {
        await ref.read(reviewApiProvider).update(widget.existing!.id, rating: _rating, title: _title.text, comment: _comment.text, images: _newImages);
      } else {
        await ref.read(reviewApiProvider).create(orderItemId: widget.orderItemId!, rating: _rating, title: _title.text, comment: _comment.text, images: _newImages);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not save: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _title.dispose();
    _comment.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: AppSpacing.m, right: AppSpacing.m, top: AppSpacing.m, bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.m),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.existing == null ? 'Write a review' : 'Edit your review', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.m),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              5,
              (i) => IconButton(
                onPressed: () => setState(() => _rating = i + 1),
                icon: Icon(i < _rating ? Icons.star : Icons.star_border, color: AppTheme.brass, size: 32),
              ),
            ),
          ),
          TextField(controller: _title, decoration: const InputDecoration(labelText: 'Title (optional)')),
          const SizedBox(height: AppSpacing.m),
          TextField(controller: _comment, maxLines: 4, decoration: const InputDecoration(labelText: 'Your review (optional)')),
          const SizedBox(height: AppSpacing.m),
          Wrap(
            spacing: AppSpacing.s,
            children: [
              if (widget.existing != null)
                for (final img in widget.existing!.images) SizedBox(width: 56, height: 56, child: CataloguePlate(child: Image.network(img.url, fit: BoxFit.cover))),
              for (final f in _newImages) SizedBox(width: 56, height: 56, child: CataloguePlate(child: Image.file(File(f.path), fit: BoxFit.cover))),
              if (_newImages.length < 5) OutlinedButton.icon(onPressed: _addPhoto, icon: const Icon(Icons.add_a_photo_outlined), label: const Text('Add photos')),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: AppSpacing.s),
            Text(_error!, style: const TextStyle(color: AppTheme.danger)),
          ],
          const SizedBox(height: AppSpacing.l),
          PrimaryButton(label: 'Submit', busy: _busy, onPressed: _submit),
        ],
      ),
    );
  }
}
