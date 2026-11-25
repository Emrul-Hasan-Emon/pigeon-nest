import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/image_thumb.dart';
import '../data/review_models.dart';
import '../data/reviews_api.dart';
import 'review_dialogs.dart';
import 'reviews_screen.dart';

/// One review and the conversation under it. Replies to a reply load when opened.
class ReviewThreadScreen extends ConsumerStatefulWidget {
  const ReviewThreadScreen({super.key, required this.review});
  final Review review;

  @override
  ConsumerState<ReviewThreadScreen> createState() => _ReviewThreadScreenState();
}

class _ReviewThreadScreenState extends ConsumerState<ReviewThreadScreen> {
  Review get r => widget.review;
  final _open = <int>{};

  void _say(String t) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t)));

  Future<void> _run(Future<void> Function() action, {String? done}) async {
    try {
      await action();
      ref.invalidate(repliesProvider);
      ref.invalidate(reviewSummaryProvider);
      if (done != null && mounted) _say(done);
    } on ApiException catch (e) {
      if (mounted) _say(e.message);
    }
  }

  Future<void> _reply({int? parentId}) async {
    final text = await askText(context, title: 'Reply');
    if (text != null) await _run(() => ref.read(reviewsApiProvider).reply(r.id, text, parentId: parentId));
  }

  Future<void> _report(Future<void> Function(String, String?) send) async {
    final result = await askReport(context);
    if (result != null) await _run(() => send(result.$1, result.$2), done: 'Reported. A moderator will look at it.');
  }

  Widget _replies(int? parentId, int depth) {
    final data = ref.watch(repliesProvider((reviewId: r.id, parentId: parentId)));
    return data.when(
      loading: () => const Padding(padding: EdgeInsets.all(AppSpacing.s), child: Center(child: CircularProgressIndicator(strokeWidth: 2))),
      error: (e, _) => Text(ApiException.from(e).message, style: const TextStyle(color: AppTheme.danger)),
      data: (list) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (final p in list)
          Padding(
            padding: EdgeInsets.only(left: depth == 0 ? 0 : AppSpacing.m, top: AppSpacing.s),
            child: Container(
              padding: const EdgeInsets.all(AppSpacing.s),
              decoration: BoxDecoration(color: p.fromSeller ? AppTheme.info.withValues(alpha: 0.08) : Colors.white, border: Border.all(color: AppTheme.border), borderRadius: BorderRadius.circular(10)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${p.authorName}${p.fromSeller ? ' (you)' : p.authorType == 'admin' ? ' (marketplace)' : ''} · ${formatDate(p.createdAt)}', style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
                Text(p.deleted ? 'Removed' : p.hidden ? 'Hidden by a moderator' : p.body),
                Wrap(spacing: AppSpacing.s, children: [
                  TextButton(onPressed: () => _reply(parentId: p.id), child: const Text('Reply')),
                  if (p.fromSeller && !p.deleted)
                    TextButton(
                      onPressed: () async {
                        final text = await askText(context, title: 'Change your reply', initial: p.body, action: 'Save');
                        if (text != null) await _run(() => ref.read(reviewsApiProvider).editReply(p.id, text));
                      },
                      child: const Text('Edit'),
                    ),
                  if (!p.fromSeller && p.authorType == 'user') TextButton(onPressed: () => _report((reason, note) => ref.read(reviewsApiProvider).reportReply(p.id, reason, note: note)), child: const Text('Report')),
                  if (p.replyCount > 0)
                    TextButton(onPressed: () => setState(() => _open.contains(p.id) ? _open.remove(p.id) : _open.add(p.id)), child: Text(_open.contains(p.id) ? 'Hide replies' : 'Show ${p.replyCount} ${p.replyCount == 1 ? 'reply' : 'replies'}')),
                ]),
                if (_open.contains(p.id)) _replies(p.id, depth + 1),
              ]),
            ),
          ),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Review')),
        body: ListView(padding: const EdgeInsets.all(AppSpacing.m), children: [
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [Stars(r.rating), const Spacer(), Text(formatDate(r.createdAt), style: const TextStyle(color: AppTheme.neutral, fontSize: 12))]),
              Text(r.productName, style: const TextStyle(color: AppTheme.neutral, fontSize: 13)),
              if (r.title != null) Text(r.title!, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              if (r.comment != null) Text(r.comment!),
              if (r.imageUrls.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Wrap(spacing: 6, children: [for (final u in r.imageUrls) ImageThumb(u, size: 72)])),
              Text(r.reviewerName, style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
              const SizedBox(height: AppSpacing.s),
              Row(children: [
                Expanded(child: FilledButton(onPressed: () => _reply(), style: FilledButton.styleFrom(minimumSize: const Size(0, 48)), child: const Text('Reply'))),
                const SizedBox(width: AppSpacing.s),
                OutlinedButton(onPressed: () => _report((reason, note) => ref.read(reviewsApiProvider).reportReview(r.id, reason, note: note)), style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48), foregroundColor: AppTheme.danger), child: const Text('Report')),
              ]),
            ]),
          ),
          const SizedBox(height: AppSpacing.m),
          const Text('Replies', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
          _replies(null, 0),
        ]),
      );
}
