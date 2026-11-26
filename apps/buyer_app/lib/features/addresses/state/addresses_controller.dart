import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/address_model.dart';
import '../data/addresses_api.dart';

final addressesProvider = AsyncNotifierProvider<AddressesController, List<AddressView>>(AddressesController.new);

class AddressesController extends AsyncNotifier<List<AddressView>> {
  @override
  Future<List<AddressView>> build() => ref.read(addressesApiProvider).list();

  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => ref.read(addressesApiProvider).list());
  }

  Future<void> add(AddressInput input) async {
    await ref.read(addressesApiProvider).create(input);
    await reload();
  }

  Future<void> edit(int id, AddressInput input) async {
    await ref.read(addressesApiProvider).update(id, input);
    await reload();
  }

  Future<void> remove(int id) async {
    await ref.read(addressesApiProvider).remove(id);
    await reload();
  }
}
