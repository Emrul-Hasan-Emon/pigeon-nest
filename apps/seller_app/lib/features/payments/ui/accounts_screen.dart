import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../data/payment_models.dart';
import '../data/payments_api.dart';
import 'account_form_sheet.dart';

/// Bank and online wallet accounts buyers see on an order when they have to pay.
class AccountsScreen extends ConsumerWidget {
  const AccountsScreen({super.key});

  Future<void> _open(BuildContext context, WidgetRef ref, [PayAccount? account]) async {
    final saved = await showModalBottomSheet<bool>(context: context, isScrollControlled: true, builder: (_) => AccountFormSheet(account: account));
    if (saved == true) ref.invalidate(payAccountsProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(payAccountsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Payment accounts')),
      floatingActionButton: FloatingActionButton.extended(onPressed: () => _open(context, ref), icon: const Icon(Icons.add), label: const Text('Add account')),
      body: data.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: ApiException.from(e).message, onRetry: () => ref.invalidate(payAccountsProvider)),
        data: (list) => list.isEmpty
            ? const EmptyView(message: 'Add an account so buyers know where to send money.', icon: Icons.account_balance_outlined)
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(AppSpacing.m, AppSpacing.m, AppSpacing.m, 96),
                itemCount: list.length,
                separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.s),
                itemBuilder: (_, i) {
                  final a = list[i];
                  return AppCard(
                    onTap: () => _open(context, ref, a),
                    child: Row(children: [
                      Icon(a.isBank ? Icons.account_balance : Icons.phone_android, color: a.isActive ? AppTheme.ink : AppTheme.neutral),
                      const SizedBox(width: AppSpacing.m),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(a.provider, style: const TextStyle(fontWeight: FontWeight.w700)),
                          Text(a.accountNumber),
                          if (a.accountName != null) Text(a.accountName!, style: const TextStyle(color: AppTheme.neutral)),
                          if (a.branchName != null) Text(a.branchName!, style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
                          if (a.note != null) Text(a.note!, style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
                        ]),
                      ),
                      Switch(
                        value: a.isActive,
                        onChanged: (v) async {
                          try {
                            await ref.read(paymentsApiProvider).setAccountActive(a.id, v);
                            ref.invalidate(payAccountsProvider);
                          } on ApiException catch (e) {
                            if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
                          }
                        },
                      ),
                    ]),
                  );
                },
              ),
      ),
    );
  }
}
