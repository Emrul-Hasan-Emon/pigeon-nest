import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/money.dart';
import '../../../shared/media/image_picker_helper.dart';
import '../../../shared/widgets/primary_button.dart';
import '../data/order_models.dart';
import '../data/order_api.dart';
import '../../../shared/widgets/key_value.dart';
import '../../../shared/widgets/section_title.dart';

/// Mark money as received. Proof is required by the server (1 to 10 files).
class RecordPaymentScreen extends ConsumerStatefulWidget {
  const RecordPaymentScreen({super.key, required this.order});
  final OrderDetail order;

  @override
  ConsumerState<RecordPaymentScreen> createState() => _RecordPaymentScreenState();
}

class _RecordPaymentScreenState extends ConsumerState<RecordPaymentScreen> {
  final _form = GlobalKey<FormState>();
  late final _amount = TextEditingController(text: widget.order.balanceDue.toStringAsFixed(2));
  final _description = TextEditingController();
  final _txn = TextEditingController();
  final _files = <XFile>[];
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _amount.dispose();
    _description.dispose();
    _txn.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    final picked = await ImagePickerHelper.pickMultipleFromGallery(limit: 10 - _files.length);
    // A picture is there now, so the old "add a picture" message no longer applies.
    setState(() {
      _files.addAll(picked.take(10 - _files.length));
      _error = null;
    });
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    if (_files.isEmpty) return setState(() => _error = 'Add at least one picture of the proof.');
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(orderRepositoryProvider).recordPayment(
            widget.order.row.id,
            description: _description.text,
            files: _files,
            amount: double.parse(_amount.text.trim()),
            transactionId: _txn.text,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Payment recorded')));
      context.pop();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final due = widget.order.balanceDue;
    return Scaffold(
      appBar: AppBar(title: const Text('Record a payment')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.m),
        child: Form(
          key: _form,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            KeyValue('Order', widget.order.row.orderNumber),
            KeyValue('Still due', formatUsd(due), bold: true),
            const SizedBox(height: AppSpacing.m),
            TextFormField(
              controller: _amount,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Amount received (USD)', prefixText: '\$ '),
              validator: (v) {
                final n = double.tryParse((v ?? '').trim());
                if (n == null || n < 0.01) return 'Enter an amount of 0.01 or more';
                if (((n * 100).round() - n * 100).abs() > 1e-6) return 'Use at most 2 decimals';
                if (n > due + 0.0001) return 'More than the ${formatUsd(due)} still due';
                return null;
              },
            ),
            const SizedBox(height: AppSpacing.m),
            TextFormField(
              controller: _description,
              maxLength: 1000,
              decoration: const InputDecoration(labelText: 'How was it paid?', hintText: 'Cash at delivery, PayPal to the shop email...'),
              validator: (v) => (v == null || v.trim().length < 3) ? 'Write at least 3 characters' : null,
            ),
            TextFormField(controller: _txn, maxLength: 100, decoration: const InputDecoration(labelText: 'Transaction ID (optional)')),
            const SizedBox(height: AppSpacing.m),
            const SectionTitle('Proof'),
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
            PrimaryButton(label: 'Record payment', busy: _busy, onPressed: _save),
          ]),
        ),
      ),
    );
  }
}
