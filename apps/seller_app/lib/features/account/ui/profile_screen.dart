import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/access_banner.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/photo_field.dart';
import '../../../shared/widgets/primary_button.dart';
import '../data/account_api.dart';
import '../data/seller_profile.dart';

/// View and edit the seller's own details, picture and ID images.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My profile')),
      body: profile.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: ApiException.from(e).message, onRetry: () => ref.invalidate(profileProvider)),
        data: (p) => _ProfileForm(profile: p),
      ),
    );
  }
}

class _ProfileForm extends ConsumerStatefulWidget {
  const _ProfileForm({required this.profile});
  final SellerProfile profile;

  @override
  ConsumerState<_ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends ConsumerState<_ProfileForm> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.profile.name);
  late final _phone = TextEditingController(text: widget.profile.phone);
  late final _email = TextEditingController(text: widget.profile.email ?? '');
  late final _about = TextEditingController(text: widget.profile.description ?? '');
  XFile? _avatar, _nidFront, _nidBack;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _email.dispose();
    _about.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    final p = widget.profile;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // Only what changed is sent.
      await ref.read(accountRepositoryProvider).updateProfile(
            name: _name.text.trim() != p.name ? _name.text.trim() : null,
            phone: _phone.text.trim() != p.phone ? _phone.text.trim() : null,
            email: _email.text.trim().isNotEmpty && _email.text.trim() != (p.email ?? '') ? _email.text.trim() : null,
            description: _about.text.trim() != (p.description ?? '') ? _about.text.trim() : null,
            avatar: _avatar,
            nidFront: _nidFront,
            nidBack: _nidBack,
          );
      if (!mounted) return;
      setState(() => _avatar = _nidFront = _nidBack = null);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile saved')));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.profile;
    final canEdit = p.access.canEditProfile;
    return SingleChildScrollView(
      padding: const EdgeInsets.only(bottom: AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AccessBanner(access: p.access),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.m),
            child: Form(
              key: _form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(child: PhotoField(label: 'Profile picture', picked: _avatar, savedUrl: p.avatarUrl, round: true, onPicked: (f) => setState(() => _avatar = f))),
                  const SizedBox(height: AppSpacing.l),
                  TextFormField(
                    controller: _name,
                    enabled: canEdit,
                    decoration: const InputDecoration(labelText: 'Shop or seller name'),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter your name' : null,
                  ),
                  const SizedBox(height: AppSpacing.m),
                  TextFormField(
                    controller: _phone,
                    enabled: canEdit,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(labelText: 'Phone number (you sign in with it)'),
                    validator: (v) => (v == null || !v.trim().startsWith('+')) ? 'Start with your country code, like +1' : null,
                  ),
                  const SizedBox(height: AppSpacing.m),
                  TextFormField(
                    controller: _email,
                    enabled: canEdit,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'Email'),
                    validator: (v) => (v == null || v.trim().isEmpty || v.contains('@')) ? null : 'Enter a valid email',
                  ),
                  const SizedBox(height: AppSpacing.m),
                  TextFormField(
                    controller: _about,
                    enabled: canEdit,
                    maxLines: 4,
                    maxLength: 1000,
                    decoration: const InputDecoration(labelText: 'About your shop', hintText: 'Shown to buyers on your shop page'),
                  ),
                  const SizedBox(height: AppSpacing.m),
                  PhotoField(label: 'ID, front side', picked: _nidFront, savedUrl: p.nidFrontUrl, onPicked: (f) => setState(() => _nidFront = f)),
                  const SizedBox(height: AppSpacing.m),
                  PhotoField(label: 'ID, back side', picked: _nidBack, savedUrl: p.nidBackUrl, onPicked: (f) => setState(() => _nidBack = f)),
                  if (_error != null) ...[
                    const SizedBox(height: AppSpacing.m),
                    Text(_error!, style: const TextStyle(color: AppTheme.danger), textAlign: TextAlign.center),
                  ],
                  const SizedBox(height: AppSpacing.l),
                  if (canEdit) PrimaryButton(label: 'Save', busy: _busy, onPressed: _save),
                  const SizedBox(height: AppSpacing.m),
                  OutlinedButton.icon(
                    onPressed: () => context.push('/more/selling'),
                    icon: const Icon(Icons.storefront_outlined),
                    label: const Text('Selling on or off, shop break'),
                  ),
                  const SizedBox(height: AppSpacing.s),
                  OutlinedButton.icon(
                    onPressed: () => context.push('/more/password'),
                    icon: const Icon(Icons.lock_outline),
                    label: const Text('Change password'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
