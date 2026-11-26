import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_client.dart';
import '../../../shared/media/multipart_upload.dart';
import 'profile_model.dart';

final accountApiProvider = Provider<AccountApi>((ref) => AccountApi(ref.read(apiClientProvider)));

/// Every server path this feature uses, in one place (rule 6 in root `rules.md`).
class AccountApi {
  AccountApi(this._client);
  final ApiClient _client;

  Future<Profile> getProfile() async {
    final json = await _client.get<Map<String, dynamic>>('/profile');
    return Profile.fromJson(json);
  }

  Future<Profile> updateProfile({String? name, String? email, String? phone, XFile? avatar}) async {
    final body = await buildMultipart(
      fields: {
        'name': ?name,
        'email': ?email,
        'phone': ?phone,
      },
      singleFiles: {'avatar': ?avatar},
    );
    final json = await _client.patch<Map<String, dynamic>>('/profile', body: body);
    return Profile.fromJson(json);
  }

  Future<void> changePassword({required String currentPassword, required String newPassword}) {
    return _client.patch<Object?>('/profile/password', body: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }
}
