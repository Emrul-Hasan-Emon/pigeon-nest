import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/primary_button.dart';
import '../data/order_api.dart';
import 'order_detail_screen.dart' show OrderDetailScreen;

/// Look an order up by its number and the phone it was placed with — no
/// account needed. Used by a guest who did not sign in at checkout.
class TrackOrderScreen extends ConsumerStatefulWidget {
  const TrackOrderScreen({super.key});

  @override
  ConsumerState<TrackOrderScreen> createState() => _TrackOrderScreenState();
}

class _TrackOrderScreenState extends ConsumerState<TrackOrderScreen> {
  final _form = GlobalKey<FormState>();
  final _orderNumber = TextEditingController();
  final _phone = TextEditingController();
  bool _busy = false;
  String? _error;
  int? _foundId;

  Future<void> _track() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
      _foundId = null;
    });
    try {
      final order = await ref.read(orderApiProvider).track(_orderNumber.text, _phone.text);
      if (mounted) setState(() => _foundId = order.id);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _orderNumber.dispose();
    _phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_foundId != null) return OrderDetailScreen(id: _foundId!);
    return Scaffold(
      appBar: AppBar(title: const Text('Track an order')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.m),
          children: [
            TextFormField(controller: _orderNumber, decoration: const InputDecoration(labelText: 'Order number'), validator: _required),
            const SizedBox(height: AppSpacing.m),
            TextFormField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone used at checkout'), validator: _required),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.m),
              Text(_error!, style: const TextStyle(color: AppTheme.danger)),
            ],
            const SizedBox(height: AppSpacing.l),
            PrimaryButton(label: 'Find my order', busy: _busy, onPressed: _track),
          ],
        ),
      ),
    );
  }

  String? _required(String? v) => (v == null || v.trim().isEmpty) ? 'Required' : null;
}
