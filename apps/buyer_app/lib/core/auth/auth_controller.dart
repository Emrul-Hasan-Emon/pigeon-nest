import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../notifications/push_service.dart';
import 'guest_session.dart';
import 'user_access.dart';

/// Unlike the seller app, `signedOut` is not a gate — most of the app (browse,
/// search, product pages) works the same while signed out. Only checkout,
/// orders, wishlist, reviews, offers and the account screens need a sign-in.
enum AuthStatus { unknown, signedOut, signedIn }

class AuthState {
  const AuthState(this.status, {this.name, this.access});
  final AuthStatus status;
  final String? name;
  final UserAccess? access;
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

  /// On start: if a token is saved and still good, go straight in. A buyer
  /// browsing signed out is a normal, expected state, not an error.
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
        name: profile['name'] as String?,
        access: UserAccess.fromJson(profile['access'] as Map<String, dynamic>?),
      );
    } on ApiException catch (e) {
      // No signal should not sign the buyer out; a rejected token should.
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

  Future<void> register({required String name, required String phone, required String password, String? email}) async {
    final data = await ref.read(apiClientProvider).post<Map<String, dynamic>>('/auth/register', body: {
      'name': name.trim(),
      'phone': phone.trim(),
      'password': password,
      if (email != null && email.trim().isNotEmpty) 'email': email.trim(),
    });
    await _startSession(data);
  }

  Future<void> _startSession(Map<String, dynamic> data) async {
    await ref.read(tokenStoreProvider).write(data['accessToken'] as String);
    applyUser(data['user'] as Map<String, dynamic>?);
    await _mergeGuestCart();
  }

  /// Folds whatever the buyer added to their cart while signed out into their
  /// account's carts, then starts a fresh guest session for next time.
  Future<void> _mergeGuestCart() async {
    try {
      final sessionId = await GuestSession.id();
      await ref.read(apiClientProvider).post<Object?>('/carts/merge', body: {'sessionId': sessionId});
      await GuestSession.reset();
    } catch (_) {
      // Nothing to merge, or the server could not be reached — the guest
      // cart is simply left as is and tried again on the next sign-in.
    }
  }

  /// Keeps the name and access banner in step with what the server just said.
  void applyUser(Map<String, dynamic>? user) {
    state = AuthState(
      AuthStatus.signedIn,
      name: user?['name'] as String?,
      access: UserAccess.fromJson(user?['access'] as Map<String, dynamic>?),
    );
  }

  Future<void> signOut() async {
    await ref.read(pushServiceProvider).unregister();
    await ref.read(tokenStoreProvider).clear();
    state = const AuthState(AuthStatus.signedOut);
  }
}
