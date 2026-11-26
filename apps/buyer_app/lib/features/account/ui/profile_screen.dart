import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/media/image_picker_helper.dart';
import '../../../shared/widgets/access_banner.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/primary_button.dart';
import '../data/profile_model.dart';
import '../state/profile_controller.dart';
import 'change_password_screen.dart';

/// My profile: view, then edit name/email/phone/avatar in place.
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  XFile? _avatar;
  bool _editing = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    super.dispose();
  }

  void _startEditing(Profile p) {
    _name.text = p.name;
    _email.text = p.email ?? '';
    _phone.text = p.phone ?? '';
    _avatar = null;
    setState(() => _editing = true);
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(profileProvider.notifier).save(name: _name.text, email: _email.text, phone: _phone.text, avatar: _avatar);
      if (mounted) setState(() => _editing = false);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(profileProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('My profile'),
        actions: [
          IconButton(tooltip: 'Sign out', icon: const Icon(Icons.logout), onPressed: () => ref.read(authProvider.notifier).signOut()),
        ],
      ),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: e is ApiException ? e.message : 'Something went wrong.', onRetry: () => ref.read(profileProvider.notifier).reload()),
        data: (profile) {
          final canEdit = profile.access.canUse;
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.m),
            children: [
              if (!profile.access.canUse) AccessBanner(access: profile.access),
              Center(
                child: GestureDetector(
                  onTap: (!_editing || !canEdit)
                      ? null
                      : () async {
                          final file = await ImagePickerHelper.pickFromGallery();
                          if (file != null) setState(() => _avatar = file);
                        },
                  child: CircleAvatar(
                    radius: 48,
                    backgroundColor: AppTheme.dove,
                    backgroundImage: _avatar != null
                        ? FileImage(File(_avatar!.path)) as ImageProvider
                        : (profile.avatarUrl != null ? NetworkImage(profile.avatarUrl!) : null),
                    child: profile.avatarUrl == null && _avatar == null
                        ? Text(profile.name.isEmpty ? '?' : profile.name[0].toUpperCase(), style: const TextStyle(fontSize: 32))
                        : null,
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.l),
              if (!_editing) ...[
                _Row(label: 'Name', value: profile.name),
                _Row(label: 'Email', value: profile.email ?? '—'),
                _Row(label: 'Phone', value: profile.phone ?? '—'),
                const SizedBox(height: AppSpacing.l),
                if (canEdit) PrimaryButton(label: 'Edit profile', onPressed: () => _startEditing(profile)),
                const SizedBox(height: AppSpacing.s),
                OutlinedButton(
                  onPressed: canEdit ? () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ChangePasswordScreen())) : null,
                  child: const Text('Change password'),
                ),
                const SizedBox(height: AppSpacing.s),
                OutlinedButton(onPressed: () => context.push('/addresses'), child: const Text('Your addresses')),
                const SizedBox(height: AppSpacing.s),
                OutlinedButton(onPressed: () => context.push('/wishlist'), child: const Text('Wishlist')),
                const SizedBox(height: AppSpacing.s),
                OutlinedButton(onPressed: () => context.push('/offers'), child: const Text('My offers')),
                const SizedBox(height: AppSpacing.s),
                OutlinedButton(onPressed: () => context.push('/reviews'), child: const Text('My reviews')),
                const SizedBox(height: AppSpacing.s),
                OutlinedButton(onPressed: () => context.push('/returns'), child: const Text('Returns')),
              ] else
                Form(
                  key: _form,
                  child: Column(
                    children: [
                      TextFormField(
                        controller: _name,
                        decoration: const InputDecoration(labelText: 'Name'),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter your name' : null,
                      ),
                      const SizedBox(height: AppSpacing.m),
                      TextFormField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
                      const SizedBox(height: AppSpacing.m),
                      TextFormField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone number')),
                      if (_error != null) ...[
                        const SizedBox(height: AppSpacing.m),
                        Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                      ],
                      const SizedBox(height: AppSpacing.l),
                      PrimaryButton(label: 'Save changes', busy: _busy, onPressed: _save),
                      const SizedBox(height: AppSpacing.s),
                      TextButton(onPressed: _busy ? null : () => setState(() => _editing = false), child: const Text('Cancel')),
                    ],
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.s),
      child: Row(
        children: [
          SizedBox(width: 90, child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.slate))),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
