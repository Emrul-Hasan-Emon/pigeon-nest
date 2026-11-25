import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../theme/app_theme.dart';

/// True while the phone has no network at all.
final offlineProvider = StreamProvider<bool>((ref) async* {
  final connectivity = Connectivity();
  bool none(List<ConnectivityResult> r) => r.isEmpty || r.every((c) => c == ConnectivityResult.none);
  yield none(await connectivity.checkConnectivity());
  yield* connectivity.onConnectivityChanged.map(none);
});

/// A thin bar on top of every screen while there is no internet. The screens keep showing what they have.
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(offlineProvider).value != true) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      color: AppTheme.ink,
      padding: EdgeInsets.fromLTRB(AppSpacing.m, MediaQuery.of(context).padding.top + 6, AppSpacing.m, 6),
      child: const Row(children: [
        Icon(Icons.wifi_off, color: Colors.white, size: 18),
        SizedBox(width: AppSpacing.s),
        Expanded(child: Text('No internet. Pull down to refresh when it is back.', style: TextStyle(color: Colors.white, fontSize: 13))),
      ]),
    );
  }
}
