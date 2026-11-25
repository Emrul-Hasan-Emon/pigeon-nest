import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/primary_button.dart';
import '../data/payment_models.dart';
import '../data/payments_api.dart';

/// Add or change one payment account. The kind cannot change after it is saved.
class AccountFormSheet extends ConsumerStatefulWidget {
  const AccountFormSheet({super.key, this.account});
  final PayAccount? account;

  @override
  ConsumerState<AccountFormSheet> createState() => _AccountFormSheetState();
}

class _AccountFormSheetState extends ConsumerState<AccountFormSheet> {
  final _form = GlobalKey<FormState>();
  late String _kind = widget.account?.kind ?? 'mfs';
  late final _provider = TextEditingController(text: widget.account?.provider ?? '');
  late final _name = TextEditingController(text: widget.account?.accountName ?? '');
  late final _number = TextEditingController(text: widget.account?.accountNumber ?? '');
  late final _branch = TextEditingController(text: widget.account?.branchName ?? '');
  late final _note = TextEditingController(text: widget.account?.note ?? '');
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_provider, _name, _number, _branch, _note]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final api = ref.read(paymentsApiProvider);
    try {
      if (widget.account == null) {
        await api.createAccount(kind: _kind, provider: _provider.text, number: _number.text, name: _name.text, branch: _branch.text, note: _note.text);
      } else {
        await api.updateAccount(widget.account!.id, provider: _provider.text, number: _number.text, name: _name.text, branch: _branch.text, note: _note.text);
      }
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.m),
          child: Form(
            key: _form,
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(widget.account == null ? 'Add an account' : 'Change account', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
              const SizedBox(height: AppSpacing.m),
              if (widget.account == null)
                SegmentedButton<String>(
                  segments: const [ButtonSegment(value: 'mfs', label: Text('Online wallet'), icon: Icon(Icons.phone_android)), ButtonSegment(value: 'bank', label: Text('Bank'), icon: Icon(Icons.account_balance))],
                  selected: {_kind},
                  onSelectionChanged: (s) => setState(() => _kind = s.first),
                ),
              const SizedBox(height: AppSpacing.s),
              TextFormField(controller: _provider, maxLength: 80, decoration: InputDecoration(labelText: _kind == 'bank' ? 'Bank name' : 'Provider (PayPal, Wise...)'), validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null),
              TextFormField(controller: _number, maxLength: 60, decoration: const InputDecoration(labelText: 'Account number or email'), validator: (v) => (v == null || v.trim().length < 3) ? 'At least 3 characters' : null),
              TextFormField(controller: _name, maxLength: 120, decoration: const InputDecoration(labelText: 'Account holder name (optional)')),
              if (_kind == 'bank') TextFormField(controller: _branch, maxLength: 120, decoration: const InputDecoration(labelText: 'Branch (optional)')),
              TextFormField(controller: _note, maxLength: 200, decoration: const InputDecoration(labelText: 'Note for buyers (optional)')),
              if (_error != null) Text(_error!, style: const TextStyle(color: AppTheme.danger), textAlign: TextAlign.center),
              const SizedBox(height: AppSpacing.s),
              PrimaryButton(label: 'Save', busy: _busy, onPressed: _save),
            ]),
          ),
        ),
      );
}
