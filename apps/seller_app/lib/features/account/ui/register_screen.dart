import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/photo_field.dart';
import '../../../shared/widgets/primary_button.dart';

/// Open a shop. The seller is signed in right after and waits for approval.
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  XFile? _avatar, _nidFront, _nidBack;
  bool _busy = false;
  bool _hide = true;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authProvider.notifier).register(
            name: _name.text,
            phone: _phone.text,
            password: _password.text,
            email: _email.text,
            avatar: _avatar,
            nidFront: _nidFront,
            nidBack: _nidBack,
          );
      // The router moves on by itself once signed in.
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Open your shop')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.l),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Form(
                key: _form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('Our team checks every new shop. You can sign in now and sell once you are approved.'),
                    const SizedBox(height: AppSpacing.l),
                    TextFormField(
                      controller: _name,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(labelText: 'Shop or seller name', prefixIcon: Icon(Icons.storefront_outlined)),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter your name' : null,
                    ),
                    const SizedBox(height: AppSpacing.m),
                    TextFormField(
                      controller: _phone,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(labelText: 'Phone number', hintText: '+14155550123', prefixIcon: Icon(Icons.phone)),
                      validator: (v) => (v == null || !v.trim().startsWith('+')) ? 'Start with your country code, like +1' : null,
                    ),
                    const SizedBox(height: AppSpacing.m),
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(labelText: 'Email (optional)', prefixIcon: Icon(Icons.email_outlined)),
                      validator: (v) => (v == null || v.trim().isEmpty || v.contains('@')) ? null : 'Enter a valid email',
                    ),
                    const SizedBox(height: AppSpacing.m),
                    TextFormField(
                      controller: _password,
                      obscureText: _hide,
                      decoration: InputDecoration(
                        labelText: 'Password (8 or more characters)',
                        prefixIcon: const Icon(Icons.lock),
                        suffixIcon: IconButton(
                          icon: Icon(_hide ? Icons.visibility : Icons.visibility_off),
                          onPressed: () => setState(() => _hide = !_hide),
                        ),
                      ),
                      validator: (v) => (v == null || v.length < 8) ? 'Use at least 8 characters' : null,
                    ),
                    const SizedBox(height: AppSpacing.l),
                    Center(child: PhotoField(label: 'Profile picture (optional)', picked: _avatar, round: true, onPicked: (f) => setState(() => _avatar = f))),
                    const SizedBox(height: AppSpacing.m),
                    PhotoField(label: 'ID, front side (optional)', picked: _nidFront, onPicked: (f) => setState(() => _nidFront = f)),
                    const SizedBox(height: AppSpacing.m),
                    PhotoField(label: 'ID, back side (optional)', picked: _nidBack, onPicked: (f) => setState(() => _nidBack = f)),
                    if (_error != null) ...[
                      const SizedBox(height: AppSpacing.m),
                      Text(_error!, style: const TextStyle(color: AppTheme.danger), textAlign: TextAlign.center),
                    ],
                    const SizedBox(height: AppSpacing.l),
                    PrimaryButton(label: 'Create my shop', busy: _busy, onPressed: _submit),
                    const SizedBox(height: AppSpacing.s),
                    TextButton(onPressed: _busy ? null : () => context.go('/login'), child: const Text('I already have a shop')),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
