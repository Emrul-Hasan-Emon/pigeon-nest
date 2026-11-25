import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/auth/auth_controller.dart';
import 'core/network/offline_banner.dart';
import 'core/notifications/push_service.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

class SellerApp extends ConsumerStatefulWidget {
  const SellerApp({super.key});

  @override
  ConsumerState<SellerApp> createState() => _SellerAppState();
}

class _SellerAppState extends ConsumerState<SellerApp> {
  @override
  void initState() {
    super.initState();
    ref.read(pushServiceProvider).start();
  }

  @override
  Widget build(BuildContext context) {
    // Whenever a seller signs in, tell the server which phone to notify.
    ref.listen(authProvider, (prev, next) {
      if (next.status == AuthStatus.signedIn && prev?.status != AuthStatus.signedIn) ref.read(pushServiceProvider).registerWithServer();
    });
    return MaterialApp.router(
      title: 'Pigeon Nest Seller',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      routerConfig: ref.watch(routerProvider),
      builder: (context, child) => Column(children: [const OfflineBanner(), Expanded(child: child ?? const SizedBox.shrink())]),
    );
  }
}
