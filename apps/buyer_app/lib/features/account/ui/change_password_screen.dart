import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/primary_button.dart';
import '../state/profile_controller.dart';

class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  bool _busy = false;
  String? _error;
  String? _done;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
      _done = null;
    });
    try {
      await ref.read(profileProvider.notifier).changePassword(currentPassword: _current.text, newPassword: _next.text);
      if (mounted) {
        setState(() => _done = 'Password changed.');
        _current.clear();
        _next.clear();
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Change password')),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.m),
        child: Form(
          key: _form,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _current,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Current password'),
                validator: (v) => (v == null || v.isEmpty) ? 'Enter your current password' : null,
              ),
              const SizedBox(height: AppSpacing.m),
              TextFormField(
                controller: _next,
                obscureText: true,
                onFieldSubmitted: (_) => _submit(),
                decoration: const InputDecoration(labelText: 'New password'),
                validator: (v) => (v == null || v.length < 8) ? 'At least 8 characters' : null,
              ),
              if (_error != null) ...[
                const SizedBox(height: AppSpacing.m),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              if (_done != null) ...[
                const SizedBox(height: AppSpacing.m),
                Text(_done!, style: const TextStyle(color: AppTheme.success)),
              ],
              const SizedBox(height: AppSpacing.l),
              PrimaryButton(label: 'Update password', busy: _busy, onPressed: _submit),
            ],
          ),
        ),
      ),
    );
  }
}
