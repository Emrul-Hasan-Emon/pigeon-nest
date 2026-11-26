import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import 'address_model.dart';

final addressesApiProvider = Provider<AddressesApi>((ref) => AddressesApi(ref.read(apiClientProvider)));

/// Every server path this feature uses (rule 6 in root `rules.md`). At most
/// 20 saved addresses per buyer, so this is a plain list — no paging.
class AddressesApi {
  AddressesApi(this._client);
  final ApiClient _client;

  Future<List<AddressView>> list() async {
    final json = await _client.get<Map<String, dynamic>>('/profile/addresses');
    final results = json['results'] as List<dynamic>;
    return results.map((e) => AddressView.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<AddressView> create(AddressInput input) async {
    final json = await _client.post<Map<String, dynamic>>('/profile/addresses', body: input.toJson());
    return AddressView.fromJson(json);
  }

  Future<AddressView> update(int id, AddressInput input) async {
    final json = await _client.patch<Map<String, dynamic>>('/profile/addresses/$id', body: input.toJson());
    return AddressView.fromJson(json);
  }

  Future<void> remove(int id) => _client.delete<Object?>('/profile/addresses/$id');
}
