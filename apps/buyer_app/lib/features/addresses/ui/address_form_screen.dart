import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/data/countries.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/primary_button.dart';
import '../data/address_model.dart';
import '../state/addresses_controller.dart';

/// Add a new address, or edit [existing].
class AddressFormScreen extends ConsumerStatefulWidget {
  const AddressFormScreen({super.key, this.existing});
  final AddressView? existing;

  @override
  ConsumerState<AddressFormScreen> createState() => _AddressFormScreenState();
}

class _AddressFormScreenState extends ConsumerState<AddressFormScreen> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.existing?.recipientName);
  late final _phone = TextEditingController(text: widget.existing?.phone);
  late final _state = TextEditingController(text: widget.existing?.state);
  late final _city = TextEditingController(text: widget.existing?.city);
  late final _address = TextEditingController(text: widget.existing?.address);
  late final _zip = TextEditingController(text: widget.existing?.zipCode);
  late String? _countryCode = widget.existing?.countryCode;
  late bool _isDefault = widget.existing?.isDefault ?? false;
  bool _busy = false;
  String? _error;

  static final _sortedCountries = countryNames.entries.toList()..sort((a, b) => a.value.compareTo(b.value));

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _state.dispose();
    _city.dispose();
    _address.dispose();
    _zip.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    if (_countryCode == null) {
      setState(() => _error = 'Choose a country.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final input = AddressInput(
      recipientName: _name.text,
      phone: _phone.text,
      countryCode: _countryCode!,
      state: _state.text.isEmpty ? null : _state.text,
      city: _city.text,
      address: _address.text,
      zipCode: _zip.text.isEmpty ? null : _zip.text,
      isDefault: _isDefault,
    );
    try {
      final notifier = ref.read(addressesProvider.notifier);
      final existing = widget.existing;
      if (existing == null) {
        await notifier.add(input);
      } else {
        await notifier.edit(existing.id, input);
      }
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.existing == null ? 'New address' : 'Edit address')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.m),
        child: Form(
          key: _form,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Recipient name'),
                validator: (v) => (v == null || v.trim().length < 2) ? 'Enter a name' : null,
              ),
              const SizedBox(height: AppSpacing.m),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Phone number', hintText: '+8801712345678'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter a phone number' : null,
              ),
              const SizedBox(height: AppSpacing.m),
              DropdownButtonFormField<String>(
                initialValue: _countryCode,
                decoration: const InputDecoration(labelText: 'Country'),
                items: [for (final e in _sortedCountries) DropdownMenuItem(value: e.key, child: Text(e.value))],
                onChanged: (v) => setState(() => _countryCode = v),
              ),
              const SizedBox(height: AppSpacing.m),
              TextFormField(controller: _state, decoration: const InputDecoration(labelText: 'State or division (optional)')),
              const SizedBox(height: AppSpacing.m),
              TextFormField(
                controller: _city,
                decoration: const InputDecoration(labelText: 'City or district'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter a city' : null,
              ),
              const SizedBox(height: AppSpacing.m),
              TextFormField(
                controller: _address,
                maxLines: 2,
                decoration: const InputDecoration(labelText: 'Address', hintText: 'House, road, area, landmarks'),
                validator: (v) => (v == null || v.trim().length < 5) ? 'Enter the full address' : null,
              ),
              const SizedBox(height: AppSpacing.m),
              TextFormField(controller: _zip, decoration: const InputDecoration(labelText: 'Postal code (optional)')),
              const SizedBox(height: AppSpacing.m),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Make this my default address'),
                value: _isDefault,
                onChanged: (v) => setState(() => _isDefault = v),
              ),
              if (_error != null) ...[
                const SizedBox(height: AppSpacing.s),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: AppSpacing.l),
              PrimaryButton(label: widget.existing == null ? 'Save address' : 'Save changes', busy: _busy, onPressed: _submit),
            ],
          ),
        ),
      ),
    );
  }
}
