import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import 'package:image_picker/image_picker.dart';

import '../../shared/media/multipart_upload.dart';
import '../notifications/push_service.dart';
import 'seller_access.dart';

enum AuthStatus { unknown, signedOut, signedIn }

class AuthState {
  const AuthState(this.status, {this.shopName, this.access});
  final AuthStatus status;
  final String? shopName;
  final SellerAccess? access;
}

final authProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    // When any request comes back 401, the session is over.
    Future.microtask(() => ref.read(unauthorizedHandlerProvider).onUnauthorized = signOut);
    Future.microtask(restore);
    return const AuthState(AuthStatus.unknown);
  }

  /// On start: if a token is saved and still good, go straight in.
  Future<void> restore() async {
    final token = await ref.read(tokenStoreProvider).read();
    if (token == null) {
      state = const AuthState(AuthStatus.signedOut);
      return;
    }
    try {
      final profile = await ref.read(apiClientProvider).get<Map<String, dynamic>>('/profile');
      state = AuthState(
        AuthStatus.signedIn,
        shopName: profile['name'] as String?,
        access: SellerAccess.fromJson(profile['access'] as Map<String, dynamic>?),
      );
    } on ApiException catch (e) {
      // No signal should not log the seller out; a rejected token should.
      if (e.isUnauthorized) {
        await signOut();
      } else {
        state = const AuthState(AuthStatus.signedIn);
      }
    }
  }

  /// Throws [ApiException] with a plain message when the phone or password is wrong.
  Future<void> login(String phone, String password) async {
    final data = await ref.read(apiClientProvider).post<Map<String, dynamic>>(
      '/auth/login',
      body: {'phone': phone.trim(), 'password': password},
    );
    await _startSession(data);
  }

  /// Creates the shop. The seller is signed in at once, awaiting approval.
  Future<void> register({
    required String name,
    required String phone,
    required String password,
    String? email,
    XFile? avatar,
    XFile? nidFront,
    XFile? nidBack,
  }) async {
    final body = await buildMultipart(
      fields: {
        'name': name.trim(),
        'phone': phone.trim(),
        'password': password,
        if (email != null && email.trim().isNotEmpty) 'email': email.trim(),
      },
      singleFiles: {
        'avatar': ?avatar,
        'nidFrontImage': ?nidFront,
        'nidBackImage': ?nidBack,
      },
    );
    final data = await ref.read(apiClientProvider).post<Map<String, dynamic>>('/auth/register', body: body);
    await _startSession(data);
  }

  Future<void> _startSession(Map<String, dynamic> data) async {
    await ref.read(tokenStoreProvider).write(data['accessToken'] as String);
    applySeller(data['seller'] as Map<String, dynamic>?);
  }

  /// Keeps the shop name and access banner in step with what the server just said.
  void applySeller(Map<String, dynamic>? seller) {
    state = AuthState(
      AuthStatus.signedIn,
      shopName: seller?['name'] as String?,
      access: SellerAccess.fromJson(seller?['access'] as Map<String, dynamic>?),
    );
  }

  Future<void> signOut() async {
    // While the token still works, stop this phone's notifications for the shop.
    await ref.read(pushServiceProvider).unregister();
    await ref.read(tokenStoreProvider).clear();
    state = const AuthState(AuthStatus.signedOut);
  }
}
