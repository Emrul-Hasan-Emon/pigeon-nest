import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/paged_list.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/question_models.dart';
import '../data/questions_api.dart';

class QuestionsScreen extends ConsumerStatefulWidget {
  const QuestionsScreen({super.key});

  @override
  ConsumerState<QuestionsScreen> createState() => _QuestionsScreenState();
}

class _QuestionsScreenState extends ConsumerState<QuestionsScreen> {
  String _show = 'unanswered';
  String _search = '';
  int _version = 0;
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _answer(Question q) async {
    final text = TextEditingController(text: q.answer ?? '');
    String? error;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => AlertDialog(
          title: Text(q.answered ? 'Change your answer' : 'Answer this question'),
          content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(q.question, style: const TextStyle(fontStyle: FontStyle.italic)),
            const SizedBox(height: AppSpacing.s),
            TextField(controller: text, maxLines: 4, maxLength: 2000, decoration: const InputDecoration(labelText: 'Your answer')),
            if (error != null) Text(error!, style: const TextStyle(color: AppTheme.danger)),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Back')),
            FilledButton(
              onPressed: () => text.text.trim().length < 2 ? set(() => error = 'Write at least 2 characters.') : Navigator.pop(ctx, true),
              style: FilledButton.styleFrom(minimumSize: const Size(110, 48)),
              child: const Text('Send'),
            ),
          ],
        ),
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(questionsApiProvider).answer(q.id, text.text);
      ref.invalidate(questionSummaryProvider);
      if (mounted) setState(() => _version++);
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final sum = ref.watch(questionSummaryProvider).value;
    final chips = [
      (sum == null ? 'Not answered' : 'Not answered (${sum.unanswered})', 'unanswered'),
      (sum == null ? 'Answered' : 'Answered (${sum.answered})', 'answered'),
      ('All', 'all'),
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('Questions')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(AppSpacing.m),
          child: TextField(
            decoration: const InputDecoration(hintText: 'Search questions', prefixIcon: Icon(Icons.search)),
            onChanged: (v) {
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 500), () => setState(() => _search = v));
            },
          ),
        ),
        SizedBox(
          height: 44,
          child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m), children: [
            for (final (label, value) in chips)
              Padding(padding: const EdgeInsets.only(right: AppSpacing.s), child: ChoiceChip(label: Text(label), selected: _show == value, onSelected: (_) => setState(() => _show = value))),
          ]),
        ),
        Expanded(
          child: PagedList<Question>(
            fetch: ref.read(questionsApiProvider).listFetcher(show: _show, search: _search),
            reloadKey: '$_show|$_search|$_version',
            emptyText: 'No questions here.',
            emptyIcon: Icons.help_outline,
            itemBuilder: (context, q) => AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(q.productName, style: const TextStyle(color: AppTheme.neutral, fontSize: 13)),
                const SizedBox(height: AppSpacing.xs),
                Text(q.question, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                Text('${q.askerName} · ${formatDate(q.createdAt)}', style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
                if (q.hidden) Padding(padding: const EdgeInsets.only(top: 4), child: StatusBadge(label: 'Hidden${q.hiddenReason == null ? '' : ': ${q.hiddenReason}'}', tone: StatusTone.danger)),
                if (q.answered) ...[const Divider(), Text(q.answer!)],
                const SizedBox(height: AppSpacing.s),
                OutlinedButton(onPressed: () => _answer(q), child: Text(q.answered ? 'Change answer' : 'Answer')),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}
