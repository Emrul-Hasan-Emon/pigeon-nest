import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../data/account_api.dart';
import '../data/seller_profile.dart';

/// Where each checklist step leads. Product steps have no screen yet (Phase 3),
/// so they stay as plain text until then.
const _stepRoutes = <String, String>{
  'avatar': '/more/profile',
  'about': '/more/profile',
  'email': '/more/profile',
  'nid': '/more/profile',
};

class ChecklistScreen extends ConsumerWidget {
  const ChecklistScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(onboardingProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Get your shop ready')),
      body: data.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: ApiException.from(e).message, onRetry: () => ref.invalidate(onboardingProvider)),
        data: (o) => ListView(
          padding: const EdgeInsets.all(AppSpacing.m),
          children: [
            _Progress(onboarding: o),
            const SizedBox(height: AppSpacing.m),
            for (final step in o.steps)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.s),
                child: AppCard(
                  onTap: !step.done && _stepRoutes[step.key] != null ? () => context.push(_stepRoutes[step.key]!) : null,
                  child: Row(
                    children: [
                      Icon(step.done ? Icons.check_circle : Icons.radio_button_unchecked, color: step.done ? AppTheme.success : AppTheme.neutral),
                      const SizedBox(width: AppSpacing.m),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(step.label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                            const SizedBox(height: 2),
                            Text(step.hint, style: const TextStyle(color: AppTheme.neutral)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Progress extends StatelessWidget {
  const _Progress({required this.onboarding});
  final Onboarding onboarding;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('${onboarding.done} of ${onboarding.total} done', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
        const SizedBox(height: AppSpacing.s),
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: LinearProgressIndicator(value: onboarding.percent / 100, minHeight: 10, color: AppTheme.success, backgroundColor: AppTheme.border),
        ),
      ],
    );
  }
}

/// Small card for the Home tab; hidden once everything is done or while loading.
class ChecklistCard extends ConsumerWidget {
  const ChecklistCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final o = ref.watch(onboardingProvider).value;
    if (o == null || o.complete) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.m, AppSpacing.m, AppSpacing.m, 0),
      child: AppCard(
        onTap: () => context.push('/more/checklist'),
        child: Row(
          children: [
            const Icon(Icons.checklist, color: AppTheme.info),
            const SizedBox(width: AppSpacing.m),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Get your shop ready', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  Text('${o.done} of ${o.total} steps done', style: const TextStyle(color: AppTheme.neutral)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right),
          ],
        ),
      ),
    );
  }
}
