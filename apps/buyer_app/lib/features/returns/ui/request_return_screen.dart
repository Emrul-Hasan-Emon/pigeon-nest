import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/format/money.dart';
import '../../../shared/media/image_picker_helper.dart';
import '../../../shared/widgets/catalogue_plate.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/primary_button.dart';
import '../data/return_api.dart';
import '../data/return_models.dart';

final returnEligibilityProvider = FutureProvider.autoDispose.family<ReturnEligibility, int>((ref, orderId) => ref.read(returnApiProvider).eligibility(orderId));

/// Checks what can be returned on an order, then sends the request:
/// whole order or specific items, a reason, and optional evidence photos.
class RequestReturnScreen extends ConsumerStatefulWidget {
  const RequestReturnScreen({super.key, required this.orderId});
  final int orderId;

  @override
  ConsumerState<RequestReturnScreen> createState() => _RequestReturnScreenState();
}

class _RequestReturnScreenState extends ConsumerState<RequestReturnScreen> {
  bool _fullOrder = true;
  final _selectedItems = <int>{};
  String? _reasonCode;
  final _reason = TextEditingController();
  final _files = <XFile>[];
  bool _busy = false;
  String? _error;

  Future<void> _addPhoto() async {
    final files = await ImagePickerHelper.pickMultipleFromGallery(limit: 5 - _files.length);
    setState(() => _files.addAll(files));
  }

  Future<void> _submit(ReturnEligibility e) async {
    if (_reason.text.trim().length < 5) {
      setState(() => _error = 'Say a bit more about why (at least 5 characters).');
      return;
    }
    if (!_fullOrder && _selectedItems.isEmpty) {
      setState(() => _error = 'Pick at least one item.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(returnApiProvider).create(
            orderId: widget.orderId,
            scope: _fullOrder ? 'full_order' : 'items',
            orderItemIds: _fullOrder ? null : _selectedItems.toList(),
            reasonCode: _reasonCode,
            reason: _reason.text,
            files: _files,
          );
      if (mounted) context.go('/returns');
    } catch (ex) {
      if (mounted) setState(() => _error = 'Could not submit: $ex');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(returnEligibilityProvider(widget.orderId));
    return Scaffold(
      appBar: AppBar(title: const Text('Request a return')),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: 'Could not check return eligibility.', onRetry: () => ref.invalidate(returnEligibilityProvider(widget.orderId))),
        data: (e) {
          if (!e.fullOrderAllowed && e.items.every((i) => !i.allowed)) {
            return Center(child: Padding(padding: const EdgeInsets.all(AppSpacing.l), child: Text(e.fullOrderReason ?? 'This order cannot be returned.', textAlign: TextAlign.center)));
          }
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.m),
            children: [
              if (e.fullOrderAllowed)
                RadioGroup<bool>(
                  groupValue: _fullOrder,
                  onChanged: (v) => setState(() => _fullOrder = v ?? true),
                  child: Column(children: [
                    RadioListTile<bool>(contentPadding: EdgeInsets.zero, value: true, title: Text('Return the whole order — refund ${formatUsd(e.fullOrderRefund)}')),
                    RadioListTile<bool>(contentPadding: EdgeInsets.zero, value: false, title: const Text('Return specific items')),
                  ]),
                ),
              if (!_fullOrder || !e.fullOrderAllowed) ...[
                const SizedBox(height: AppSpacing.s),
                for (final item in e.items)
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: _selectedItems.contains(item.orderItemId),
                    onChanged: item.allowed ? (checked) => setState(() => checked == true ? _selectedItems.add(item.orderItemId) : _selectedItems.remove(item.orderItemId)) : null,
                    title: Text(item.productName),
                    subtitle: Text(item.allowed ? '${item.quantity} × refund ${formatUsd(item.refundAmount)}' : item.reason ?? 'Not eligible'),
                  ),
              ],
              const SizedBox(height: AppSpacing.l),
              Text('Reason', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppSpacing.xs),
              Wrap(
                spacing: AppSpacing.s,
                children: [for (final r in kReturnReasons) ChoiceChip(label: Text(r.$2), selected: _reasonCode == r.$1, onSelected: (sel) => setState(() => _reasonCode = sel ? r.$1 : null))],
              ),
              const SizedBox(height: AppSpacing.m),
              TextField(controller: _reason, maxLines: 3, decoration: const InputDecoration(labelText: 'Tell the seller what happened')),
              const SizedBox(height: AppSpacing.m),
              Wrap(
                spacing: AppSpacing.s,
                children: [
                  for (final f in _files) SizedBox(width: 56, height: 56, child: CataloguePlate(child: Image.file(File(f.path), fit: BoxFit.cover))),
                  if (_files.length < 5) OutlinedButton.icon(onPressed: _addPhoto, icon: const Icon(Icons.add_a_photo_outlined), label: const Text('Add photos')),
                ],
              ),
              if (_error != null) ...[
                const SizedBox(height: AppSpacing.m),
                Text(_error!, style: const TextStyle(color: AppTheme.danger)),
              ],
              const SizedBox(height: AppSpacing.l),
              PrimaryButton(label: 'Submit return request', busy: _busy, onPressed: () => _submit(e)),
            ],
          );
        },
      ),
    );
  }
}
