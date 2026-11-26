import '../../../shared/state/list_refresh.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/money.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/primary_button.dart';
import '../data/product_models.dart';
import '../data/product_api.dart';
import '../data/sku_draft.dart';
import 'sku_editor_screen.dart';
import '../../../shared/widgets/section_title.dart';

/// Add a product ([productId] null) or edit one. Options (SKUs) are edited on their own screen.
class ProductFormScreen extends ConsumerWidget {
  const ProductFormScreen({super.key, this.productId});
  final int? productId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lookups = ref.watch(formLookupsProvider);
    final detail = productId == null ? null : ref.watch(productDetailProvider(productId!));
    final title = productId == null ? 'Add product' : 'Edit product';
    Widget wait(Widget child) => Scaffold(appBar: AppBar(title: Text(title)), body: child);

    if (lookups.hasError) return wait(ErrorView(message: ApiException.from(lookups.error!).message, onRetry: () => ref.invalidate(formLookupsProvider)));
    if (detail != null && detail.hasError) return wait(ErrorView(message: ApiException.from(detail.error!).message, onRetry: () => ref.invalidate(productDetailProvider(productId!))));
    if (!lookups.hasValue || (detail != null && !detail.hasValue)) return wait(const LoadingView());
    return _Form(title: title, lookups: lookups.requireValue, product: detail?.requireValue);
  }
}

class _Form extends ConsumerStatefulWidget {
  const _Form({required this.title, required this.lookups, this.product});
  final String title;
  final FormLookups lookups;
  final ProductDetail? product;

  @override
  ConsumerState<_Form> createState() => _FormState();
}

class _FormState extends ConsumerState<_Form> {
  final _form = GlobalKey<FormState>();
  ProductDetail? get _p => widget.product;
  late final _name = TextEditingController(text: _p?.row.name ?? '');
  late final _description = TextEditingController(text: _p?.description ?? '');
  late final _seoTitle = TextEditingController(text: _p?.seoTitle ?? '');
  late final _seoDescription = TextEditingController(text: _p?.seoDescription ?? '');
  late final _breed = TextEditingController(text: _p?.row.breed ?? '');
  late final _bloodline = TextEditingController(text: _p?.bloodline ?? '');
  late final _bloodlineNote = TextEditingController(text: _p?.bloodlineNote ?? '');
  late final _vaccinationNote = TextEditingController(text: _p?.vaccinationNote ?? '');
  late final _healthNote = TextEditingController(text: _p?.healthNote ?? '');
  late final _raceRecord = TextEditingController(text: _p?.raceRecord ?? '');
  late int? _categoryId = _p?.categoryId;
  late int? _collectionId = _p?.collectionId;
  late bool _startActive = true;
  late final List<SkuDraft> _skus = [for (final s in _p?.skus ?? const <Sku>[]) SkuDraft.fromSku(s)];
  final _removed = <int>[];
  bool _busy = false;
  String? _error;

  bool get _editing => _p != null;

  @override
  void dispose() {
    for (final c in [_name, _description, _seoTitle, _seoDescription, _breed, _bloodline, _bloodlineNote, _vaccinationNote, _healthNote, _raceRecord]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickCategory() async {
    final picked = await showModalBottomSheet<Category>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _CategorySheet(items: widget.lookups.categories),
    );
    FocusManager.instance.primaryFocus?.unfocus();
    if (picked != null) setState(() => _categoryId = picked.id);
  }

  Future<void> _editSku(SkuDraft? draft) async {
    final result = await Navigator.of(context).push<SkuDraft>(MaterialPageRoute(
      builder: (_) => SkuEditorScreen(draft: draft ?? SkuDraft(isDefault: _skus.isEmpty), attributes: widget.lookups.attributes, productId: _p?.row.id),
    ));
    // Coming back from the option screen must not pop the keyboard up on the field that had focus before.
    FocusManager.instance.primaryFocus?.unfocus();
    if (result == null) return;
    setState(() {
      if (result.isDefault) {
        for (final s in _skus) {
          s.isDefault = false;
        }
      }
      final at = draft == null ? -1 : _skus.indexOf(draft);
      if (at >= 0) {
        _skus[at] = result;
      } else {
        _skus.add(result);
      }
    });
  }

  Map<String, dynamic> _productFields({required bool clearEmpty}) {
    Map<String, dynamic> text(Map<String, TextEditingController> m) => {
          for (final e in m.entries)
            if (clearEmpty || e.value.text.trim().isNotEmpty) e.key: e.value.text.trim(),
        };
    return {
      'name': _name.text.trim(),
      'categoryId': _categoryId,
      if (_editing || _collectionId != null) 'collectionId': _collectionId,
      ...text({
        'description': _description,
        'seoTitle': _seoTitle,
        'seoDescription': _seoDescription,
      }),
      // Bird facts: an empty box clears the fact when editing.
      ...{
        for (final e in {
          'breed': _breed,
          'bloodline': _bloodline,
          'bloodlineNote': _bloodlineNote,
          'vaccinationNote': _vaccinationNote,
          'healthNote': _healthNote,
          'raceRecord': _raceRecord,
        }.entries)
          if (clearEmpty || e.value.text.trim().isNotEmpty) e.key: e.value.text.trim(),
      },
    };
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    if (_categoryId == null) return setState(() => _error = 'Choose a category.');
    if (_skus.isEmpty) return setState(() => _error = 'Add at least one option to sell.');
    for (final s in _skus) {
      final problem = s.problem();
      if (problem != null) return setState(() => _error = '${s.label}: $problem');
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final repo = ref.read(productRepositoryProvider);
    try {
      if (_editing) {
        await repo.update(_p!.row.id, {
          ..._productFields(clearEmpty: true),
          'skus': [for (final s in _skus) s.isNew ? s.toCreateJson() : s.toUpdateJson()],
          if (_removed.isNotEmpty) 'removeSkuIds': _removed,
        });
        ref.invalidate(productDetailProvider(_p!.row.id));
        ref.read(listRefreshProvider('products').notifier).bump();
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Product saved')));
        context.pop();
      } else {
        final id = await repo.create({
          ..._productFields(clearEmpty: false),
          'activeStatus': _startActive ? 'active' : 'inactive',
          'skus': [for (final s in _skus) s.toCreateJson()],
        });
        ref.read(listRefreshProvider('products').notifier).bump();
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Product added. Add its pictures next.')));
        context.pushReplacement('/products/$id/pictures');
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String? _required(String? v) => (v == null || v.trim().isEmpty) ? 'Required' : null;

  @override
  Widget build(BuildContext context) {
    final category = widget.lookups.categories.where((c) => c.id == _categoryId).firstOrNull;
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.m),
        child: Form(
          key: _form,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _section('The product', [
              TextFormField(controller: _name, maxLength: 400, decoration: const InputDecoration(labelText: 'Name'), validator: _required),
              TextFormField(controller: _description, maxLines: 5, maxLength: 20000, decoration: const InputDecoration(labelText: 'Description (optional)')),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Category'),
                subtitle: Text(category?.path ?? 'Choose one'),
                trailing: const Icon(Icons.chevron_right),
                onTap: _pickCategory,
              ),
              DropdownButtonFormField<int?>(
                initialValue: widget.lookups.collections.any((c) => c.id == _collectionId) ? _collectionId : null,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Collection (optional)'),
                items: [const DropdownMenuItem<int?>(value: null, child: Text('None')), for (final c in widget.lookups.collections) DropdownMenuItem<int?>(value: c.id, child: Text(c.name))],
                onChanged: (v) => setState(() => _collectionId = v),
              ),
              if (!_editing) SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Switch on right away'), subtitle: const Text('Buyers see it as soon as it is saved.'), value: _startActive, onChanged: (v) => setState(() => _startActive = v)),
            ]),
            _section('Options you sell (each bird, colour or size)', [
              for (final s in _skus)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(s.label, style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text('${s.priceValue == null ? '-' : formatUsd(s.priceValue!)} · ${s.quantity} in stock${s.isActive ? '' : ' · off'}${s.isNew && _editing ? ' · not saved yet' : ''}'),
                  trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                    IconButton(
                      icon: const Icon(Icons.delete_outline, color: AppTheme.danger),
                      onPressed: () async {
                        if (_skus.length == 1) return setState(() => _error = 'A product needs at least one option.');
                        final ok = await showDialog<bool>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            content: Text('Remove "${s.label}"?${s.isNew ? '' : ' It is removed when you save.'}'),
                            actions: [
                              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep')),
                              FilledButton(onPressed: () => Navigator.pop(ctx, true), style: FilledButton.styleFrom(minimumSize: const Size(110, 48), backgroundColor: AppTheme.danger), child: const Text('Remove')),
                            ],
                          ),
                        );
                        if (ok != true) return;
                        setState(() {
                          _skus.remove(s);
                          if (s.id != null) _removed.add(s.id!);
                        });
                      },
                    ),
                    const Icon(Icons.chevron_right),
                  ]),
                  onTap: () => _editSku(s),
                ),
              OutlinedButton.icon(onPressed: () => _editSku(null), icon: const Icon(Icons.add), label: const Text('Add an option')),
            ]),
            _section('About the birds (optional)', [
              TextFormField(controller: _breed, maxLength: 120, decoration: const InputDecoration(labelText: 'Breed')),
              TextFormField(controller: _bloodline, maxLength: 120, decoration: const InputDecoration(labelText: 'Bloodline')),
              TextFormField(controller: _bloodlineNote, maxLines: 3, decoration: const InputDecoration(labelText: 'Bloodline note')),
              TextFormField(controller: _vaccinationNote, maxLines: 3, decoration: const InputDecoration(labelText: 'Vaccination note')),
              TextFormField(controller: _healthNote, maxLines: 3, decoration: const InputDecoration(labelText: 'Health note')),
              TextFormField(controller: _raceRecord, maxLines: 3, decoration: const InputDecoration(labelText: 'Race record')),
            ]),
            _section('Search text (optional)', [
              TextFormField(controller: _seoTitle, maxLength: 255, decoration: const InputDecoration(labelText: 'Title for search engines')),
              TextFormField(controller: _seoDescription, maxLines: 3, maxLength: 1000, decoration: const InputDecoration(labelText: 'Description for search engines')),
            ]),
            if (_error != null) Padding(padding: const EdgeInsets.only(bottom: AppSpacing.m), child: Text(_error!, style: const TextStyle(color: AppTheme.danger), textAlign: TextAlign.center)),
            PrimaryButton(label: _editing ? 'Save product' : 'Add product', busy: _busy, onPressed: _save),
            const SizedBox(height: AppSpacing.xl),
          ]),
        ),
      ),
    );
  }

  Widget _section(String title, List<Widget> children) => Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.m),
        child: AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [SectionTitle(title), ...children])),
      );
}

class _CategorySheet extends StatefulWidget {
  const _CategorySheet({required this.items});
  final List<Category> items;

  @override
  State<_CategorySheet> createState() => _CategorySheetState();
}

class _CategorySheetState extends State<_CategorySheet> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final shown = widget.items.where((c) => c.path.toLowerCase().contains(_q.toLowerCase())).toList();
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.75,
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.m),
            child: TextField(autofocus: true, decoration: const InputDecoration(hintText: 'Search categories', prefixIcon: Icon(Icons.search)), onChanged: (v) => setState(() => _q = v)),
          ),
          Expanded(
            child: ListView(children: [for (final c in shown) ListTile(title: Text(c.path), onTap: () => Navigator.pop(context, c))]),
          ),
        ]),
      ),
      ),
    );
  }
}
