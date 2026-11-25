import 'package:flutter/material.dart';

/// The one "fetching data" view, so every list/detail screen looks the same
/// while it waits on the server.
class LoadingView extends StatelessWidget {
  const LoadingView({super.key});

  @override
  Widget build(BuildContext context) => const Center(child: CircularProgressIndicator());
}
