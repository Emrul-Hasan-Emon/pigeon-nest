import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/data/countries.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/money.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../addresses/data/address_model.dart';
import '../../addresses/state/addresses_controller.dart';
import '../../cart/data/cart_models.dart';
import '../../cart/state/carts_controller.dart';
import '../data/checkout_api.dart';
import '../data/checkout_models.dart';

/// Checkout for one seller's cart: recipient, address, delivery with live
/// price, payment method with its proof fields, then place the order.
class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key, required this.cartId});
  final int cartId;

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final _form = GlobalKey<FormState>();
  final _recipientName = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _state = TextEditingController();
  final _city = TextEditingController();
  final _addressLine = TextEditingController();
  final _postalCode = TextEditingController();
  final _note = TextEditingController();
  final _proof = <String, TextEditingController>{};

  String? _countryCode;
  DeliveryType? _deliveryType;
  int? _gatewayId;
  CheckoutOptions? _options;
  bool _loadingOptions = true;
  bool _placing = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({String? countryCode}) async {
    setState(() => _loadingOptions = true);
    try {
      final options = await ref.read(checkoutApiProvider).options(widget.cartId, countryCode: countryCode);
      if (!mounted) return;
      setState(() {
        _options = options;
        _countryCode = countryCode ?? _countryCode;
        _gatewayId ??= options.paymentGateways.isNotEmpty ? options.paymentGateways.first.id : null;
        if (_deliveryType == null && options.deliveryOptions.isNotEmpty) _deliveryType = options.deliveryOptions.first.type;
        _loadingOptions = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loadingOptions = false);
    }
  }

  void _useAddress(AddressView a) {
    _recipientName.text = a.recipientName;
    _phone.text = a.phone;
    _state.text = a.state ?? '';
    _city.text = a.city;
    _addressLine.text = a.address;
    _postalCode.text = a.zipCode ?? '';
    if (a.countryCode != _countryCode) {
      _load(countryCode: a.countryCode);
    } else {
      setState(() => _countryCode = a.countryCode);
    }
  }

  TextEditingController _proofController(String key) => _proof.putIfAbsent(key, TextEditingController.new);

  Future<void> _place() async {
    if (!_form.currentState!.validate() || _countryCode == null || _deliveryType == null || _gatewayId == null) {
      setState(() => _error = 'Fill in your address, delivery and payment method.');
      return;
    }
    final gateway = _options!.paymentGateways.firstWhere((g) => g.id == _gatewayId);
    setState(() {
      _placing = true;
      _error = null;
    });
    try {
      final order = await ref.read(checkoutApiProvider).place(
            widget.cartId,
            PlaceOrderInput(
              recipientName: _recipientName.text,
              recipientPhone: _phone.text,
              contactEmail: _email.text,
              countryCode: _countryCode!,
              state: _state.text,
              city: _city.text,
              addressLine: _addressLine.text,
              postalCode: _postalCode.text,
              deliveryType: _deliveryType!,
              paymentGatewayId: _gatewayId!,
              note: _note.text,
              paymentProof: gateway.proofFields.isEmpty ? null : {for (final f in gateway.proofFields) f.key: _proofController(f.key).text},
              expectedItemsTotal: _options!.cart.totals.payableTotal,
            ),
          );
      await ref.read(cartsProvider.notifier).reload();
      if (mounted) context.go('/orders/${order.id}?placed=true');
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _placing = false);
    }
  }

  @override
  void dispose() {
    _recipientName.dispose();
    _phone.dispose();
    _email.dispose();
    _state.dispose();
    _city.dispose();
    _addressLine.dispose();
    _postalCode.dispose();
    _note.dispose();
    for (final c in _proof.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: _loadingOptions
          ? const LoadingView()
          : _options == null
              ? ErrorView(message: 'Could not load checkout.', onRetry: () => _load(countryCode: _countryCode))
              : Form(
                  key: _form,
                  child: ListView(
                    padding: const EdgeInsets.all(AppSpacing.m),
                    children: [
                      _SavedAddresses(onPick: _useAddress),
                      Text('Delivery to', style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: AppSpacing.s),
                      TextFormField(controller: _recipientName, decoration: const InputDecoration(labelText: 'Recipient name'), validator: _required),
                      const SizedBox(height: AppSpacing.m),
                      TextFormField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone'), validator: _required),
                      const SizedBox(height: AppSpacing.m),
                      TextFormField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email (optional)')),
                      const SizedBox(height: AppSpacing.m),
                      DropdownButtonFormField<String>(
                        initialValue: _countryCode,
                        decoration: const InputDecoration(labelText: 'Country'),
                        items: [
                          for (final entry in (countryNames.entries.toList()..sort((a, b) => a.value.compareTo(b.value))))
                            DropdownMenuItem(value: entry.key, child: Text(entry.value)),
                        ],
                        onChanged: (v) {
                          if (v != null) _load(countryCode: v);
                        },
                        validator: (v) => v == null ? 'Pick a country' : null,
                      ),
                      const SizedBox(height: AppSpacing.m),
                      TextFormField(controller: _state, decoration: const InputDecoration(labelText: 'State / province (optional)')),
                      const SizedBox(height: AppSpacing.m),
                      TextFormField(controller: _city, decoration: const InputDecoration(labelText: 'City'), validator: _required),
                      const SizedBox(height: AppSpacing.m),
                      TextFormField(controller: _addressLine, decoration: const InputDecoration(labelText: 'Address'), maxLines: 2, validator: _required),
                      const SizedBox(height: AppSpacing.m),
                      TextFormField(controller: _postalCode, decoration: const InputDecoration(labelText: 'Postal code (optional)')),
                      const SizedBox(height: AppSpacing.l),
                      Text('Delivery', style: Theme.of(context).textTheme.titleMedium),
                      if (_countryCode == null)
                        const Padding(padding: EdgeInsets.symmetric(vertical: AppSpacing.s), child: Text('Pick a country to see delivery options.', style: TextStyle(color: AppTheme.slate)))
                      else if (_options!.deliveryOptions.isEmpty)
                        const Padding(padding: EdgeInsets.symmetric(vertical: AppSpacing.s), child: Text('No delivery option for this country yet.', style: TextStyle(color: AppTheme.danger)))
                      else
                        RadioGroup<DeliveryType>(
                          groupValue: _deliveryType,
                          onChanged: (v) => setState(() => _deliveryType = v),
                          child: Column(children: [
                            for (final d in _options!.deliveryOptions)
                              RadioListTile<DeliveryType>(
                                contentPadding: EdgeInsets.zero,
                                value: d.type,
                                title: Text('${d.type.label} — ${formatUsd(d.payable)}'),
                                subtitle: Text(d.estimatedDays > 0 ? '${d.estimatedDays} day(s)${d.zoneName != null ? ' · ${d.zoneName}' : ''}' : d.zoneName ?? ''),
                              ),
                          ]),
                        ),
                      const SizedBox(height: AppSpacing.l),
                      Text('Payment method', style: Theme.of(context).textTheme.titleMedium),
                      RadioGroup<int>(
                        groupValue: _gatewayId,
                        onChanged: (v) => setState(() => _gatewayId = v),
                        child: Column(children: [
                          for (final g in _options!.paymentGateways)
                            RadioListTile<int>(
                              contentPadding: EdgeInsets.zero,
                              value: g.id,
                              title: Text(g.name),
                              subtitle: g.description == null ? null : Text(g.description!),
                            ),
                        ]),
                      ),
                      for (final g in _options!.paymentGateways)
                        if (_gatewayId == g.id) ...[
                          if (g.accountName != null || g.accountNumber != null)
                            Padding(
                              padding: const EdgeInsets.only(left: AppSpacing.m, bottom: AppSpacing.s),
                              child: Text(
                                [if (g.bankName != null) g.bankName, if (g.accountName != null) 'Account: ${g.accountName}', if (g.accountNumber != null) 'No: ${g.accountNumber}'].join('  ·  '),
                                style: const TextStyle(color: AppTheme.slate, fontSize: 12),
                              ),
                            ),
                          for (final f in g.proofFields)
                            Padding(
                              padding: const EdgeInsets.only(left: AppSpacing.m, bottom: AppSpacing.m),
                              child: TextFormField(
                                controller: _proofController(f.key),
                                decoration: InputDecoration(labelText: f.label),
                                validator: f.required ? _required : null,
                              ),
                            ),
                        ],
                      const SizedBox(height: AppSpacing.m),
                      TextFormField(controller: _note, decoration: const InputDecoration(labelText: 'Note to seller (optional)'), maxLines: 2),
                      const SizedBox(height: AppSpacing.l),
                      _Summary(cart: _options!.cart, delivery: _deliveryType == null ? null : _options!.deliveryOptions.where((d) => d.type == _deliveryType).firstOrNull),
                      if (_error != null) ...[
                        const SizedBox(height: AppSpacing.m),
                        Text(_error!, style: const TextStyle(color: AppTheme.danger)),
                      ],
                      const SizedBox(height: AppSpacing.l),
                      PrimaryButton(label: 'Place order', busy: _placing, onPressed: _place),
                    ],
                  ),
                ),
    );
  }

  String? _required(String? v) => (v == null || v.trim().isEmpty) ? 'Required' : null;
}

class _SavedAddresses extends ConsumerWidget {
  const _SavedAddresses({required this.onPick});
  final ValueChanged<AddressView> onPick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(addressesProvider);
    final addresses = async.asData?.value ?? [];
    if (addresses.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.m),
      child: SizedBox(
        height: 40,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: addresses.length,
          separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.s),
          itemBuilder: (_, i) => ActionChip(label: Text(addresses[i].type), onPressed: () => onPick(addresses[i])),
        ),
      ),
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.cart, required this.delivery});
  final Cart cart;
  final DeliveryOption? delivery;

  @override
  Widget build(BuildContext context) {
    final itemsTotal = cart.totals.payableTotal;
    final deliveryCharge = delivery?.charge ?? 0;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: AppTheme.line), borderRadius: BorderRadius.circular(6)),
      child: Column(
        children: [
          _row('Items', formatUsd(itemsTotal)),
          _row('Delivery', formatUsd(deliveryCharge)),
          const Divider(),
          _row('Total', formatUsd(itemsTotal + deliveryCharge), bold: true),
        ],
      ),
    );
  }

  Widget _row(String label, String value, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [Text(label), Text(value, style: TextStyle(fontWeight: bold ? FontWeight.w700 : FontWeight.normal))],
        ),
      );
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
