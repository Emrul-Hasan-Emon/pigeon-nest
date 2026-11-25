import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/ui/login_screen.dart';
import '../../features/home/ui/home_shell.dart';
import '../auth/auth_controller.dart';

final routerProvider = Provider<GoRouter>((ref) {
  // Tell the router to re-check its redirect whenever the sign-in state changes.
  final refresh = ValueNotifier<int>(0);
  ref.listen(authProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      final status = ref.read(authProvider).status;
      final atLogin = state.matchedLocation == '/login';
      if (status == AuthStatus.unknown) return null;
      if (status == AuthStatus.signedOut) return atLogin ? null : '/login';
      return atLogin ? '/' : null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/', builder: (_, _) => const HomeShell()),
    ],
    errorBuilder: (_, _) => const Scaffold(body: Center(child: Text('Page not found'))),
  );
});
