import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../data/question_api.dart';

final productQuestionsProvider = FutureProvider.autoDispose.family<QuestionPage, int>((ref, productId) => ref.read(questionApiProvider).forProduct(productId, 1));

/// Dropped into a product's detail page: questions already asked, and a way
/// to ask a new one (sign-in required).
class QuestionsSection extends ConsumerWidget {
  const QuestionsSection({super.key, required this.productId});
  final int productId;

  Future<void> _ask(BuildContext context, WidgetRef ref) async {
    if (ref.read(authProvider).status != AuthStatus.signedIn) {
      context.push('/login');
      return;
    }
    final controller = TextEditingController();
    final question = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Ask a question'),
        content: TextField(controller: controller, maxLines: 3, decoration: const InputDecoration(hintText: 'At least 10 characters so the seller can answer well')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, controller.text), child: const Text('Ask')),
        ],
      ),
    );
    if (question == null || question.trim().length < 10) return;
    await ref.read(questionApiProvider).ask(productId, question.trim());
    ref.invalidate(productQuestionsProvider(productId));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(productQuestionsProvider(productId));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text('Questions', style: Theme.of(context).textTheme.titleMedium)),
            TextButton(onPressed: () => _ask(context, ref), child: const Text('Ask a question')),
          ],
        ),
        async.when(
          loading: () => const Padding(padding: EdgeInsets.symmetric(vertical: AppSpacing.m), child: Center(child: CircularProgressIndicator())),
          error: (e, _) => const SizedBox.shrink(),
          data: (page) {
            if (page.results.isEmpty) return const Padding(padding: EdgeInsets.symmetric(vertical: AppSpacing.s), child: Text('No questions yet.', style: TextStyle(color: AppTheme.slate)));
            return Column(
              children: [
                for (final q in page.results)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.m),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [const Icon(Icons.help_outline, size: 16, color: AppTheme.slate), const SizedBox(width: 6), Expanded(child: Text(q.question, style: const TextStyle(fontWeight: FontWeight.w600)))]),
                        Padding(padding: const EdgeInsets.only(left: 22, top: 2), child: Text('${q.askerName} · ${formatDate(q.createdAt)}', style: const TextStyle(color: AppTheme.slate, fontSize: 11))),
                        if (q.answer != null)
                          Padding(
                            padding: const EdgeInsets.only(left: 22, top: 6),
                            child: Row(children: [const Icon(Icons.subdirectory_arrow_right, size: 14, color: AppTheme.teal), const SizedBox(width: 4), Expanded(child: Text(q.answer!))]),
                          ),
                      ],
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}
