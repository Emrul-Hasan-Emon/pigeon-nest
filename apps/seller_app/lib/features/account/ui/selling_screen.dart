import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/primary_button.dart';
import '../data/account_api.dart';
import '../data/seller_profile.dart';

/// Selling on or off, and a planned break between two days.
class SellingScreen extends ConsumerWidget {
  const SellingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Selling')),
      body: profile.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: ApiException.from(e).message, onRetry: () => ref.invalidate(profileProvider)),
        data: (p) => _SellingForm(profile: p),
      ),
    );
  }
}

String _key(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

DateTime? _parse(String? key) {
  if (key == null) return null;
  final parts = key.split('-');
  if (parts.length != 3) return null;
  return DateTime(int.parse(parts[0]), int.parse(parts[1]), int.parse(parts[2]));
}

class _SellingForm extends ConsumerStatefulWidget {
  const _SellingForm({required this.profile});
  final SellerProfile profile;

  @override
  ConsumerState<_SellingForm> createState() => _SellingFormState();
}

class _SellingFormState extends ConsumerState<_SellingForm> {
  late bool _enabled = widget.profile.isEnabledForSell;
  late DateTime? _start = _parse(widget.profile.breakStartsOn);
  late DateTime? _end = _parse(widget.profile.breakEndsOn);
  late final _note = TextEditingController(text: widget.profile.breakNote ?? '');
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _pick(bool start) async {
    final today = DateTime.now();
    final first = DateTime(today.year, today.month, today.day);
    final initial = (start ? _start : _end) ?? first;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial.isBefore(first) ? first : initial,
      firstDate: first,
      lastDate: first.add(const Duration(days: 730)),
    );
    if (picked == null) return;
    setState(() {
      if (start) {
        _start = picked;
        if (_end != null && _end!.isBefore(picked)) _end = picked;
      } else {
        _end = picked;
        _start ??= picked;
        if (_start!.isAfter(picked)) _start = picked;
      }
    });
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final hasBreak = _enabled && _start != null && _end != null;
      await ref.read(accountRepositoryProvider).setSelling(
            enabled: _enabled,
            breakStartsOn: hasBreak ? _key(_start!) : null,
            breakEndsOn: hasBreak ? _key(_end!) : null,
            note: _note.text.trim().isEmpty ? null : _note.text.trim(),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Saved')));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canEdit = widget.profile.access.canEditProfile;
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.m),
      children: [
        AppCard(
          child: SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Selling is on', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
            subtitle: Text(_enabled ? 'Buyers can see your shop and products.' : 'Your shop and products are hidden from buyers.'),
            value: _enabled,
            onChanged: canEdit ? (v) => setState(() => _enabled = v) : null,
          ),
        ),
        if (_enabled) ...[
          const SizedBox(height: AppSpacing.m),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Plan a break', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
                const SizedBox(height: AppSpacing.xs),
                const Text('Your shop is hidden from the first day to the last day, both included.', style: TextStyle(color: AppTheme.neutral)),
                const SizedBox(height: AppSpacing.m),
                _DateRow(label: 'First day', date: _start, onTap: canEdit ? () => _pick(true) : null),
                const SizedBox(height: AppSpacing.s),
                _DateRow(label: 'Last day', date: _end, onTap: canEdit ? () => _pick(false) : null),
                if (_start != null || _end != null)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(onPressed: () => setState(() => _start = _end = null), child: const Text('Clear the break')),
                  ),
                const SizedBox(height: AppSpacing.s),
                TextField(
                  controller: _note,
                  enabled: canEdit,
                  maxLength: 300,
                  decoration: const InputDecoration(labelText: 'Note for yourself (optional)'),
                ),
              ],
            ),
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: AppSpacing.m),
          Text(_error!, style: const TextStyle(color: AppTheme.danger), textAlign: TextAlign.center),
        ],
        const SizedBox(height: AppSpacing.l),
        if (canEdit) PrimaryButton(label: 'Save', busy: _busy, onPressed: _save),
      ],
    );
  }
}

class _DateRow extends StatelessWidget {
  const _DateRow({required this.label, required this.date, required this.onTap});
  final String label;
  final DateTime? date;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: const Icon(Icons.event),
      label: Align(alignment: Alignment.centerLeft, child: Text('$label: ${date == null ? 'not set' : formatDate(date!)}')),
      style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(52), foregroundColor: AppTheme.ink),
    );
  }
}
