import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../auth/auth_controller.dart';
import '../router/app_router.dart';

final pushServiceProvider = Provider<PushService>((ref) => PushService(ref));

/// Push notifications. Needs the Firebase files of the project (`google-services.json` on Android,
/// `GoogleService-Info.plist` on iOS). Without them [start] does nothing and the app works as before.
class PushService {
  PushService(this._ref);
  final Ref _ref;

  String? _token;
  bool _ready = false;

  /// Call once when the app opens.
  Future<void> start() async {
    try {
      await Firebase.initializeApp();
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      // getToken and onTokenRefresh are marked old, but they give the registration token the server's
      // FCM HTTP v1 call expects. The newer register() gives an installation ID instead.
      // ignore: deprecated_member_use
      _token = await messaging.getToken();
      _ready = true;
      // ignore: deprecated_member_use
      messaging.onTokenRefresh.listen((t) {
        _token = t;
        registerWithServer();
      });
      FirebaseMessaging.onMessageOpenedApp.listen(_open);
      final first = await messaging.getInitialMessage();
      if (first != null) _open(first);
      await registerWithServer();
    } catch (_) {
      // No Firebase project set up yet, or the user said no: the app simply has no push.
      _ready = false;
    }
  }

  /// Tells the server which phone to notify. Called after sign-in and when the token changes.
  Future<void> registerWithServer() async {
    final token = _token;
    if (!_ready || token == null || _ref.read(authProvider).status != AuthStatus.signedIn) return;
    try {
      await _ref.read(apiClientProvider).post<Object?>('/devices', body: {'token': token, 'platform': Platform.isIOS ? 'ios' : 'android'});
    } catch (_) {
      // Tried again at the next start or token change.
    }
  }

  /// Stops this shop's notifications on this phone. Called right before signing out.
  Future<void> unregister() async {
    final token = _token;
    if (!_ready || token == null) return;
    try {
      await _ref.read(apiClientProvider).post<Object?>('/devices/unregister', body: {'token': token}).timeout(const Duration(seconds: 3));
    } catch (_) {
      // A dead token is cleaned up by the server the next time it fails.
    }
  }

  /// A tap on a notification opens the screen the server named in `route`.
  void _open(RemoteMessage message) {
    final route = message.data['route'];
    if (route == null || route.isEmpty) return;
    final router = _ref.read(routerProvider);
    route.startsWith('/?') ? router.go(route) : router.push(route);
  }
}
