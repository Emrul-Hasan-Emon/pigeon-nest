import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/media/image_picker_helper.dart';
import '../../../shared/widgets/primary_button.dart';
import '../data/order_api.dart';

/// A note and/or pictures the customer sees on the order (tracking number, photo of the packed birds).
class PostUpdateScreen extends ConsumerStatefulWidget {
  const PostUpdateScreen({super.key, required this.orderId});
  final int orderId;

  @override
  ConsumerState<PostUpdateScreen> createState() => _PostUpdateScreenState();
}

class _PostUpdateScreenState extends ConsumerState<PostUpdateScreen> {
  final _message = TextEditingController();
  final _files = <XFile>[];
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    final picked = await ImagePickerHelper.pickMultipleFromGallery(limit: 10 - _files.length);
    setState(() => _files.addAll(picked.take(10 - _files.length)));
  }

  Future<void> _post() async {
    if (_message.text.trim().isEmpty && _files.isEmpty) return setState(() => _error = 'Write a message or add a picture.');
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(orderRepositoryProvider).postUpdate(widget.orderId, message: _message.text, files: _files);
      if (mounted) context.pop();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Post an update')),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.m),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('The customer sees this on their order. It cannot be edited or deleted later.', style: TextStyle(color: AppTheme.neutral)),
            const SizedBox(height: AppSpacing.m),
            TextField(controller: _message, maxLines: 4, maxLength: 2000, decoration: const InputDecoration(labelText: 'Message')),
            const SizedBox(height: AppSpacing.s),
            Wrap(spacing: AppSpacing.s, runSpacing: AppSpacing.s, children: [
              for (var i = 0; i < _files.length; i++)
                Stack(children: [
                  ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.file(File(_files[i].path), width: 80, height: 80, fit: BoxFit.cover)),
                  Positioned(
                    right: 0,
                    top: 0,
                    child: InkWell(
                      onTap: () => setState(() => _files.removeAt(i)),
                      child: const CircleAvatar(radius: 12, backgroundColor: Colors.black54, child: Icon(Icons.close, size: 14, color: Colors.white)),
                    ),
                  ),
                ]),
              if (_files.length < 10)
                InkWell(
                  onTap: _add,
                  child: Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(color: Colors.white, border: Border.all(color: AppTheme.border), borderRadius: BorderRadius.circular(8)),
                    child: const Icon(Icons.add_a_photo_outlined, color: AppTheme.neutral),
                  ),
                ),
            ]),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.m),
              Text(_error!, style: const TextStyle(color: AppTheme.danger), textAlign: TextAlign.center),
            ],
            const SizedBox(height: AppSpacing.l),
            PrimaryButton(label: 'Post update', busy: _busy, onPressed: _post),
          ]),
        ),
      );
}
