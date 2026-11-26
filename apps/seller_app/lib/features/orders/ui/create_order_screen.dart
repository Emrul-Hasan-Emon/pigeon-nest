import '../../../shared/state/list_refresh.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/money.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/primary_button.dart';
import '../data/order_models.dart';
import '../data/order_api.dart';
import '../../../shared/widgets/key_value.dart';
import '../../../shared/widgets/section_title.dart';
import '../../../shared/format/text.dart';

class _Line {
  _Line(this.sku, this.qty);
  final CatalogSku sku;
  int qty;
}

/// Enter an order for a phone or in-shop customer: customer, items, address, delivery and payment method.
/// Prices always come from the live SKUs on the server.
class CreateOrderScreen extends ConsumerStatefulWidget {
  const CreateOrderScreen({super.key});

  @override
  ConsumerState<CreateOrderScreen> createState() => _CreateOrderScreenState();
}

class _CreateOrderScreenState extends ConsumerState<CreateOrderScreen> {
  final _form = GlobalKey<FormState>();
  final _find = TextEditingController();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _city = TextEditingController();
  final _state = TextEditingController();
  final _line = TextEditingController();
  final _zip = TextEditingController();
  final _note = TextEditingController();

  FoundCustomer? _customer;
  List<FoundCustomer>? _found;
  List<SavedAddress> _saved = const [];
  final _lines = <_Line>[];
  OrderOptions? _options;
  String _country = 'US';
  String? _delivery;
  int? _gatewayId;
  bool _busy = false;
  String? _error;

  OrderRepository get _repo => ref.read(orderRepositoryProvider);

  /// Whole cents, so the total never drifts.
  double get _subtotal => _lines.fold<int>(0, (sum, l) => sum + (l.sku.payable * 100).round() * l.qty) / 100;

  double get _charge => _options?.delivery.where((d) => d.type == _delivery).firstOrNull?.charge ?? 0;

  @override
  void initState() {
    super.initState();
    _loadOptions();
  }

  @override
  void dispose() {
    for (final c in [_find, _name, _phone, _email, _city, _state, _line, _zip, _note]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadOptions() async {
    try {
      final o = await _repo.options(countryCode: _country, subtotal: _subtotal);
      if (!mounted) return;
      setState(() {
        _options = o;
        if (!o.delivery.any((d) => d.type == _delivery)) _delivery = o.delivery.firstOrNull?.type;
        if (!o.gateways.any((g) => g.id == _gatewayId)) _gatewayId = o.gateways.firstOrNull?.id;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _search() async {
    final q = _find.text.trim();
    if (q.length < 5) return setState(() => _error = 'Type at least 5 characters of the email or phone.');
    setState(() => _error = null);
    try {
      final r = await _repo.findCustomers(q);
      if (mounted) setState(() => _found = r);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _pick(FoundCustomer c) async {
    setState(() {
      _customer = c;
      _found = null;
      if (_name.text.isEmpty) _name.text = c.name;
      if (_phone.text.isEmpty) _phone.text = c.contact.startsWith('+') ? c.contact : '';
    });
    try {
      final a = await _repo.addressesOf(c.id);
      if (mounted) setState(() => _saved = a);
    } on ApiException {
      // Saved addresses are a convenience; typing one still works.
    }
  }

  void _useAddress(SavedAddress a) {
    setState(() {
      _name.text = a.recipientName;
      _phone.text = a.phone;
      _city.text = a.city;
      _state.text = a.state ?? '';
      _line.text = a.line;
      _zip.text = a.postalCode ?? '';
      _country = a.countryCode.isEmpty ? _country : a.countryCode;
    });
    _loadOptions();
  }

  Future<void> _addItems() async {
    final picked = await showModalBottomSheet<CatalogSku>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => const _CatalogSheet(),
    );
    if (picked == null) return;
    setState(() {
      final existing = _lines.where((l) => l.sku.id == picked.id).firstOrNull;
      if (existing != null) {
        if (existing.qty < picked.stock && existing.qty < 99) existing.qty++;
      } else {
        _lines.add(_Line(picked, 1));
      }
    });
    _loadOptions();
  }

  Future<void> _create() async {
    if (!_form.currentState!.validate()) return;
    if (_lines.isEmpty) return setState(() => _error = 'Add at least one item.');
    if (_delivery == null || _gatewayId == null) return setState(() => _error = 'Choose delivery and a payment method.');
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final id = await _repo.createOrder({
        'userId': ?_customer?.id,
        'items': [
          for (final l in _lines) {'sellerProductId': l.sku.productId, 'sellerProductSkuId': l.sku.id, 'quantity': l.qty},
        ],
        'recipientName': _name.text.trim(),
        'recipientPhone': _phone.text.trim(),
        if (_email.text.trim().isNotEmpty) 'contactEmail': _email.text.trim(),
        'countryCode': _country,
        if (_state.text.trim().isNotEmpty) 'state': _state.text.trim(),
        'city': _city.text.trim(),
        'addressLine': _line.text.trim(),
        if (_zip.text.trim().isNotEmpty) 'postalCode': _zip.text.trim(),
        'deliveryType': _delivery,
        'paymentGatewayId': _gatewayId,
        if (_note.text.trim().isNotEmpty) 'note': _note.text.trim(),
        'expectedItemsTotal': _subtotal,
      });
      ref.read(listRefreshProvider('orders').notifier).bump();
      if (!mounted) return;
      context.pushReplacement('/orders/$id');
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String? _required(String? v) => (v == null || v.trim().isEmpty) ? 'Required' : null;

  @override
  Widget build(BuildContext context) {
    final o = _options;
    return Scaffold(
      appBar: AppBar(title: const Text('New order')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.m),
        child: Form(
          key: _form,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _section('Customer', [
              if (_customer != null)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.person),
                  title: Text(_customer!.name),
                  subtitle: Text(_customer!.contact),
                  trailing: TextButton(onPressed: () => setState(() {
                        _customer = null;
                        _saved = const [];
                      }), child: const Text('Change')),
                )
              else ...[
                const Text('Search by email or phone, or leave empty for a walk-in customer.', style: TextStyle(color: AppTheme.neutral)),
                const SizedBox(height: AppSpacing.s),
                TextField(
                  controller: _find,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (_) => _search(),
                  decoration: InputDecoration(hintText: 'Email or +1415...', suffixIcon: IconButton(icon: const Icon(Icons.search), onPressed: _search)),
                ),
                if (_found != null && _found!.isEmpty) const Padding(padding: EdgeInsets.only(top: 8), child: Text('No account found. Enter the customer below as a walk-in.')),
                for (final c in _found ?? const <FoundCustomer>[])
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(c.name),
                    subtitle: Text(c.canOrder ? c.contact : '${c.contact} · suspended'),
                    enabled: c.canOrder,
                    onTap: () => _pick(c),
                  ),
              ],
            ]),
            _section('Items', [
              for (final l in _lines)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(l.sku.productName, style: const TextStyle(fontWeight: FontWeight.w600)),
                        Text('${l.sku.label} · ${formatUsd(l.sku.payable)}', style: const TextStyle(color: AppTheme.neutral, fontSize: 13)),
                      ]),
                    ),
                    IconButton(
                      icon: const Icon(Icons.remove_circle_outline),
                      onPressed: () {
                        setState(() => l.qty > 1 ? l.qty-- : _lines.remove(l));
                        _loadOptions();
                      },
                    ),
                    Text('${l.qty}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    IconButton(
                      icon: const Icon(Icons.add_circle_outline),
                      onPressed: l.qty >= l.sku.stock || l.qty >= 99
                          ? null
                          : () {
                              setState(() => l.qty++);
                              _loadOptions();
                            },
                    ),
                  ]),
                ),
              OutlinedButton.icon(onPressed: _addItems, icon: const Icon(Icons.add), label: const Text('Add an item')),
            ]),
            _section('Delivery address', [
              if (_saved.isNotEmpty) ...[
                const Text('Saved addresses', style: TextStyle(fontWeight: FontWeight.w600)),
                Wrap(spacing: AppSpacing.s, children: [
                  for (final a in _saved) ActionChip(label: Text('${a.recipientName}, ${a.city}'), onPressed: () => _useAddress(a)),
                ]),
                const SizedBox(height: AppSpacing.s),
              ],
              TextFormField(controller: _name, decoration: const InputDecoration(labelText: 'Recipient name'), validator: _required),
              const SizedBox(height: AppSpacing.s),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Recipient phone', hintText: '+14155552671'),
                validator: (v) => (v == null || !v.trim().startsWith('+')) ? 'Start with the country code, like +1' : null,
              ),
              const SizedBox(height: AppSpacing.s),
              TextFormField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email (optional)')),
              const SizedBox(height: AppSpacing.s),
              DropdownButtonFormField<String>(
                initialValue: o?.countries.any((c) => c.$1 == _country) == true ? _country : null,
                isExpanded: true,
                menuMaxHeight: 360,
                decoration: const InputDecoration(labelText: 'Country'),
                items: [for (final c in o?.countries ?? const <(String, String)>[]) DropdownMenuItem(value: c.$1, child: Text(c.$2, overflow: TextOverflow.ellipsis))],
                onChanged: (v) {
                  if (v == null) return;
                  setState(() => _country = v);
                  _loadOptions();
                },
              ),
              const SizedBox(height: AppSpacing.s),
              TextFormField(controller: _city, decoration: const InputDecoration(labelText: 'City'), validator: _required),
              const SizedBox(height: AppSpacing.s),
              TextFormField(controller: _state, decoration: const InputDecoration(labelText: 'State or region (optional)')),
              const SizedBox(height: AppSpacing.s),
              TextFormField(controller: _line, decoration: const InputDecoration(labelText: 'Street address'), validator: _required),
              const SizedBox(height: AppSpacing.s),
              TextFormField(controller: _zip, decoration: const InputDecoration(labelText: 'Postal code (optional)')),
            ]),
            _section('Delivery and payment', [
              if (o == null) const Center(child: CircularProgressIndicator()),
              if (o != null) ...[
                RadioGroup<String>(
                  groupValue: _delivery,
                  onChanged: (v) => setState(() => _delivery = v),
                  child: Column(children: [
                    for (final d in o.delivery)
                      RadioListTile<String>(
                        contentPadding: EdgeInsets.zero,
                        value: d.type,
                        title: Text('${statusLabel(d.type)} · ${formatUsd(d.charge)}'),
                        subtitle: d.estimatedDays == null ? null : Text('About ${d.estimatedDays} days'),
                      ),
                  ]),
                ),
                if (o.delivery.isEmpty) const Text('No delivery to this country.', style: TextStyle(color: AppTheme.danger)),
                const Divider(),
                RadioGroup<int>(
                  groupValue: _gatewayId,
                  onChanged: (v) => setState(() => _gatewayId = v),
                  child: Column(children: [
                    for (final g in o.gateways)
                      RadioListTile<int>(
                        contentPadding: EdgeInsets.zero,
                        value: g.id,
                        title: Text(g.name),
                        subtitle: g.typeLabel == null ? null : Text(g.typeLabel!),
                      ),
                  ]),
                ),
              ],
              TextFormField(controller: _note, maxLength: 500, decoration: const InputDecoration(labelText: 'Note (optional)')),
            ]),
            AppCard(
              child: Column(children: [
                KeyValue('Items', formatUsd(_subtotal)),
                KeyValue('Delivery', formatUsd(_charge)),
                const Divider(),
                KeyValue('Total', formatUsd((_subtotal * 100).round() / 100 + _charge), bold: true),
              ]),
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.m),
              Text(_error!, style: const TextStyle(color: AppTheme.danger), textAlign: TextAlign.center),
            ],
            const SizedBox(height: AppSpacing.l),
            PrimaryButton(label: 'Create order', busy: _busy, onPressed: _create),
            const SizedBox(height: AppSpacing.xl),
          ]),
        ),
      ),
    );
  }

  Widget _section(String title, List<Widget> children) => Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.m),
        child: AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [SectionTitle(title), ...children]),
        ),
      );
}

/// Pick one variant of one of the seller's own products.
class _CatalogSheet extends ConsumerStatefulWidget {
  const _CatalogSheet();

  @override
  ConsumerState<_CatalogSheet> createState() => _CatalogSheetState();
}

class _CatalogSheetState extends ConsumerState<_CatalogSheet> {
  final _search = TextEditingController();
  List<CatalogSku>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final r = await ref.read(orderRepositoryProvider).catalog(_search.text);
      if (mounted) setState(() => _items = r);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: SizedBox(
          height: MediaQuery.of(context).size.height * 0.75,
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.all(AppSpacing.m),
              child: TextField(
                controller: _search,
                textInputAction: TextInputAction.search,
                onSubmitted: (_) => _load(),
                decoration: InputDecoration(hintText: 'Search your products', prefixIcon: const Icon(Icons.search), suffixIcon: IconButton(icon: const Icon(Icons.arrow_forward), onPressed: _load)),
              ),
            ),
            if (_error != null) Padding(padding: const EdgeInsets.all(AppSpacing.m), child: Text(_error!, style: const TextStyle(color: AppTheme.danger))),
            Expanded(
              child: _items == null
                  ? const Center(child: CircularProgressIndicator())
                  : _items!.isEmpty
                      ? const Center(child: Text('No products found.'))
                      : ListView(children: [
                          for (final s in _items!)
                            ListTile(
                              title: Text(s.productName),
                              subtitle: Text('${s.label} · ${formatUsd(s.payable)} · ${s.stock} in stock'),
                              enabled: s.stock > 0,
                              onTap: () => Navigator.pop(context, s),
                            ),
                        ]),
            ),
          ]),
        ),
      );
}
