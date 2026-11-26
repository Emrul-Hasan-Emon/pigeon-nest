import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/auth/auth_controller.dart';
import 'core/network/offline_banner.dart';
import 'core/notifications/push_service.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

class BuyerApp extends ConsumerStatefulWidget {
  const BuyerApp({super.key});

  @override
  ConsumerState<BuyerApp> createState() => _BuyerAppState();
}

class _BuyerAppState extends ConsumerState<BuyerApp> {
  @override
  void initState() {
    super.initState();
    ref.read(pushServiceProvider).start();
  }

  @override
  Widget build(BuildContext context) {
    // Whenever a buyer signs in, tell the server which phone to notify.
    ref.listen(authProvider, (prev, next) {
      if (next.status == AuthStatus.signedIn && prev?.status != AuthStatus.signedIn) ref.read(pushServiceProvider).registerWithServer();
    });
    return MaterialApp.router(
      title: 'Pigeon Nest',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      routerConfig: ref.watch(routerProvider),
      // While the bar is showing it already covers the status bar, so the screens below must not pad for it again.
      builder: (context, child) => Column(children: [
        const OfflineBanner(),
        Expanded(child: MediaQuery.removePadding(context: context, removeTop: ref.watch(offlineProvider).value == true, child: child ?? const SizedBox.shrink())),
      ]),
    );
  }
}
