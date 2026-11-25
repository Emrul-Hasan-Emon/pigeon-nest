import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/media/image_picker_helper.dart';
import '../../../shared/widgets/primary_button.dart';
import '../data/product_models.dart';
import '../data/product_api.dart';
import '../data/sku_draft.dart';
import '../../../shared/widgets/image_thumb.dart';
import '../../../shared/widgets/section_title.dart';

/// One option of a product: choices, price, stock, bird facts, and the father and mother.
/// Returns the edited [SkuDraft] when the seller taps Done.
class SkuEditorScreen extends ConsumerStatefulWidget {
  const SkuEditorScreen({super.key, required this.draft, required this.attributes, this.productId});
  final SkuDraft draft;
  final List<Attribute> attributes;

  /// Set when the product is saved, so the father and mother can be saved straight away.
  final int? productId;

  @override
  ConsumerState<SkuEditorScreen> createState() => _SkuEditorScreenState();
}

class _SkuEditorScreenState extends ConsumerState<SkuEditorScreen> {
  late final SkuDraft d = widget.draft.copy();
  final _form = GlobalKey<FormState>();
  late final _code = TextEditingController(text: d.code);
  late final _price = TextEditingController(text: d.price);
  late final _offer = TextEditingController(text: d.offerPrice);
  late final _qty = TextEditingController(text: d.quantity);
  late final _low = TextEditingController(text: d.lowStock);
  late final _buy = TextEditingController(text: d.buyPrice);
  late final _ring = TextEditingController(text: d.ring);
  late final _vaccine = TextEditingController(text: d.vaccine);
  late final _minProposal = TextEditingController(text: d.minProposal);
  String? _error;

  @override
  void dispose() {
    for (final c in [_code, _price, _offer, _qty, _low, _buy, _ring, _vaccine, _minProposal]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDate(bool hatch) async {
    final now = DateTime.now();
    final current = DateTime.tryParse(hatch ? d.hatch : d.vaccinatedOn);
    final picked = await showDatePicker(
      context: context,
      initialDate: current ?? now,
      firstDate: DateTime(now.year - 30),
      lastDate: now,
    );
    if (picked == null) return;
    final key = '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
    setState(() => hatch ? d.hatch = key : d.vaccinatedOn = key);
  }

  void _done() {
    d
      ..code = _code.text
      ..price = _price.text
      ..offerPrice = _offer.text
      ..quantity = _qty.text
      ..lowStock = _low.text
      ..buyPrice = _buy.text
      ..ring = _ring.text
      ..vaccine = _vaccine.text
      ..minProposal = _minProposal.text;
    final problem = d.problem();
    if (problem != null) return setState(() => _error = problem);
    Navigator.pop(context, d);
  }

  Future<void> _addVariant() async {
    final used = d.variants.map((v) => v.$1).toSet();
    final free = widget.attributes.where((a) => !used.contains(a.id) && a.values.isNotEmpty).toList();
    if (free.isEmpty) return setState(() => _error = 'No more choices to add.');
    final picked = await showModalBottomSheet<(int, int, String)>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ChoiceSheet(attributes: free),
    );
    if (picked != null) setState(() => d.variants.add(picked));
  }

  @override
  Widget build(BuildContext context) {
    final saved = widget.draft.original;
    return Scaffold(
      appBar: AppBar(title: Text(d.isNew ? 'New option' : d.label, overflow: TextOverflow.ellipsis)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.m),
        child: Form(
          key: _form,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const SectionTitle('What it is'),
            Wrap(spacing: AppSpacing.s, runSpacing: AppSpacing.s, children: [
              for (final v in d.variants)
                Chip(label: Text(v.$3), onDeleted: d.isNew ? () => setState(() => d.variants.remove(v)) : null),
              if (d.isNew) ActionChip(avatar: const Icon(Icons.add, size: 18), label: const Text('Add a choice'), onPressed: _addVariant),
            ]),
            if (!d.isNew) const Padding(padding: EdgeInsets.only(top: 4), child: Text('The choices cannot be changed after saving.', style: TextStyle(color: AppTheme.neutral, fontSize: 12))),
            const SizedBox(height: AppSpacing.m),
            if (d.isNew) TextFormField(controller: _code, maxLength: 100, decoration: const InputDecoration(labelText: 'Code (optional)')),
            const SectionTitle('Price and stock'),
            _money(_price, 'Price (USD)'),
            const SizedBox(height: AppSpacing.s),
            _money(_offer, 'Offer price (leave empty for no offer)'),
            const SizedBox(height: AppSpacing.s),
            _money(_buy, 'What you paid (private, optional)'),
            const SizedBox(height: AppSpacing.s),
            Row(children: [
              Expanded(child: TextFormField(controller: _qty, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'In stock'))),
              const SizedBox(width: AppSpacing.s),
              Expanded(child: TextFormField(controller: _low, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Low stock at'))),
            ]),
            SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Customers can buy this option'), value: d.isActive, onChanged: (v) => setState(() => d.isActive = v)),
            SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Show this one first'), value: d.isDefault, onChanged: (v) => setState(() => d.isDefault = v)),
            SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Accept price offers'), value: d.acceptProposals, onChanged: (v) => setState(() => d.acceptProposals = v)),
            if (d.acceptProposals) _money(_minProposal, 'Lowest offer you will see (hidden from buyers)'),
            const SizedBox(height: AppSpacing.m),
            const SectionTitle('About this bird'),
            TextFormField(controller: _ring, maxLength: 60, decoration: const InputDecoration(labelText: 'Ring number')),
            _dateRow('Hatched on', d.hatch, () => _pickDate(true), () => setState(() => d.hatch = '')),
            TextFormField(controller: _vaccine, maxLength: 120, decoration: const InputDecoration(labelText: 'Vaccine')),
            _dateRow('Vaccinated on', d.vaccinatedOn, () => _pickDate(false), () => setState(() => d.vaccinatedOn = '')),
            const SizedBox(height: AppSpacing.m),
            if (saved != null && widget.productId != null) ...[
              const SectionTitle('Father and mother'),
              _ParentBox(productId: widget.productId!, skuId: saved.id, role: 'sire', title: 'Father', current: saved.parent('sire')),
              const SizedBox(height: AppSpacing.s),
              _ParentBox(productId: widget.productId!, skuId: saved.id, role: 'dam', title: 'Mother', current: saved.parent('dam')),
            ] else
              const Text('Save the product first, then come back to add the father and mother.', style: TextStyle(color: AppTheme.neutral)),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.m),
              Text(_error!, style: const TextStyle(color: AppTheme.danger), textAlign: TextAlign.center),
            ],
            const SizedBox(height: AppSpacing.l),
            PrimaryButton(label: 'Done', onPressed: _done),
            const SizedBox(height: AppSpacing.xl),
          ]),
        ),
      ),
    );
  }

  Widget _money(TextEditingController c, String label) => TextFormField(
        controller: c,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: InputDecoration(labelText: label, prefixText: '\$ '),
      );

  Widget _dateRow(String label, String value, VoidCallback onTap, VoidCallback onClear) => ListTile(
        contentPadding: EdgeInsets.zero,
        title: Text(label),
        subtitle: Text(value.isEmpty ? 'Not set' : value),
        trailing: value.isEmpty ? const Icon(Icons.event) : IconButton(icon: const Icon(Icons.clear), onPressed: onClear),
        onTap: onTap,
      );
}

class _ChoiceSheet extends StatefulWidget {
  const _ChoiceSheet({required this.attributes});
  final List<Attribute> attributes;

  @override
  State<_ChoiceSheet> createState() => _ChoiceSheetState();
}

class _ChoiceSheetState extends State<_ChoiceSheet> {
  Attribute? _attr;

  @override
  Widget build(BuildContext context) => SafeArea(
        child: ListView(shrinkWrap: true, padding: const EdgeInsets.all(AppSpacing.m), children: [
          Text(_attr == null ? 'Choose what to describe' : _attr!.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
          if (_attr == null)
            for (final a in widget.attributes) ListTile(title: Text(a.name), trailing: const Icon(Icons.chevron_right), onTap: () => setState(() => _attr = a))
          else
            for (final v in _attr!.values) ListTile(title: Text(v.name), onTap: () => Navigator.pop(context, (_attr!.id, v.id, '${_attr!.name}: ${v.name}'))),
        ]),
      );
}

/// A father or a mother of one saved option. Saves on its own, straight away.
class _ParentBox extends ConsumerStatefulWidget {
  const _ParentBox({required this.productId, required this.skuId, required this.role, required this.title, required this.current});
  final int productId, skuId;
  final String role, title;
  final Parent? current;

  @override
  ConsumerState<_ParentBox> createState() => _ParentBoxState();
}

class _ParentBoxState extends ConsumerState<_ParentBox> {
  late final _name = TextEditingController(text: widget.current?.name ?? '');
  late final _ring = TextEditingController(text: widget.current?.ringNumber ?? '');
  XFile? _image;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _ring.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty && _ring.text.trim().isEmpty && _image == null && widget.current?.imageUrl == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Add a name, a ring number or a picture.')));
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(productRepositoryProvider).saveParent(widget.productId, widget.skuId, widget.role, name: _name.text.trim(), ringNumber: _ring.text.trim(), image: _image);
      ref.invalidate(productDetailProvider(widget.productId));
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${widget.title} saved')));
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(AppSpacing.m),
        decoration: BoxDecoration(color: Colors.white, border: Border.all(color: AppTheme.border), borderRadius: BorderRadius.circular(12)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(widget.title, style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: AppSpacing.s),
          Row(children: [
            InkWell(
              onTap: () async {
                final f = await ImagePickerHelper.pickFromGallery();
                if (f != null) setState(() => _image = f);
              },
              child: _image != null ? const SizedBox(width: 64, height: 64, child: Icon(Icons.check_circle, color: AppTheme.success)) : ImageThumb(widget.current?.imageUrl, size: 64),
            ),
            const SizedBox(width: AppSpacing.m),
            Expanded(
              child: Column(children: [
                TextField(controller: _name, maxLength: 120, decoration: const InputDecoration(labelText: 'Name')),
                TextField(controller: _ring, maxLength: 60, decoration: const InputDecoration(labelText: 'Ring number')),
              ]),
            ),
          ]),
          OutlinedButton(onPressed: _busy ? null : _save, child: _busy ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2)) : Text('Save ${widget.title.toLowerCase()}')),
        ]),
      );
}
