import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';

enum AuthStatus { unknown, signedOut, signedIn }

class AuthState {
  const AuthState(this.status, {this.shopName});
  final AuthStatus status;
  final String? shopName;
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
      state = AuthState(AuthStatus.signedIn, shopName: profile['name'] as String?);
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
    await ref.read(tokenStoreProvider).write(data['accessToken'] as String);
    final seller = data['seller'] as Map<String, dynamic>?;
    state = AuthState(AuthStatus.signedIn, shopName: seller?['name'] as String?);
  }

  Future<void> signOut() async {
    await ref.read(tokenStoreProvider).clear();
    state = const AuthState(AuthStatus.signedOut);
  }
}
