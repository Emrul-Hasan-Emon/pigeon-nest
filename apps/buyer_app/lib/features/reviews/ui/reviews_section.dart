import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/widgets/catalogue_plate.dart';
import '../data/review_api.dart';
import '../data/review_models.dart';

final ratingSummaryProvider = FutureProvider.autoDispose.family<RatingSummary, int>((ref, productId) => ref.read(reviewApiProvider).productSummary(productId));
final productReviewsProvider = FutureProvider.autoDispose.family<CursorPage<PublicReview>, int>((ref, productId) => ref.read(reviewApiProvider).productList(productId));
final myVotesProvider = FutureProvider.autoDispose.family<Set<int>, int>((ref, productId) async {
  if (ref.watch(authProvider).status != AuthStatus.signedIn) return {};
  return ref.read(reviewApiProvider).votes(productId);
});
final reviewThreadProvider = FutureProvider.autoDispose.family<CursorPage<ReviewReply>, int>((ref, reviewId) => ref.read(reviewApiProvider).thread(reviewId));

/// Dropped into a product's detail page: the rating summary, then its
/// published reviews, each with a helpful vote, a report action and its
/// replies (read only — a buyer answers through their own review, not here).
class ReviewsSection extends ConsumerWidget {
  const ReviewsSection({super.key, required this.productId});
  final int productId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(ratingSummaryProvider(productId));
    final reviews = ref.watch(productReviewsProvider(productId));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Reviews', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSpacing.s),
        summary.when(
          loading: () => const SizedBox.shrink(),
          error: (e, _) => const SizedBox.shrink(),
          data: (s) => s.ratingCount == 0
              ? const Text('No reviews yet.', style: TextStyle(color: AppTheme.slate))
              : Row(children: [
                  const Icon(Icons.star, color: AppTheme.brass, size: 18),
                  const SizedBox(width: 4),
                  Text('${s.ratingAverage.toStringAsFixed(1)} · ${s.ratingCount} review(s)', style: const TextStyle(fontWeight: FontWeight.w600)),
                ]),
        ),
        const SizedBox(height: AppSpacing.m),
        reviews.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => const SizedBox.shrink(),
          data: (page) => Column(children: [for (final r in page.results) _ReviewTile(review: r, productId: productId)]),
        ),
      ],
    );
  }
}

class _ReviewTile extends ConsumerStatefulWidget {
  const _ReviewTile({required this.review, required this.productId});
  final PublicReview review;
  final int productId;

  @override
  ConsumerState<_ReviewTile> createState() => _ReviewTileState();
}

class _ReviewTileState extends ConsumerState<_ReviewTile> {
  bool _showReplies = false;

  Future<void> _toggleHelpful(bool voted) async {
    if (ref.read(authProvider).status != AuthStatus.signedIn) return;
    if (voted) {
      await ref.read(reviewApiProvider).unmarkHelpful(widget.review.id);
    } else {
      await ref.read(reviewApiProvider).markHelpful(widget.review.id);
    }
    ref.invalidate(myVotesProvider(widget.productId));
    ref.invalidate(productReviewsProvider(widget.productId));
  }

  Future<void> _report() async {
    const reasons = ['spam', 'abusive', 'fake', 'irrelevant', 'other'];
    final reason = await showModalBottomSheet<String>(
      context: context,
      builder: (_) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [for (final r in reasons) ListTile(title: Text(r), onTap: () => Navigator.pop(context, r))])),
    );
    if (reason == null) return;
    await ref.read(reviewApiProvider).report(widget.review.id, reason: reason);
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Reported')));
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.review;
    final votes = ref.watch(myVotesProvider(widget.productId)).asData?.value ?? {};
    final voted = votes.contains(r.id);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.m),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Row(children: List.generate(5, (i) => Icon(i < r.rating ? Icons.star : Icons.star_border, size: 14, color: AppTheme.brass))),
            const SizedBox(width: 6),
            Expanded(child: Text(r.reviewerName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
            if (r.verifiedPurchase) const Text('Verified', style: TextStyle(color: AppTheme.teal, fontSize: 11)),
          ]),
          if (r.title != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(r.title!, style: const TextStyle(fontWeight: FontWeight.w600))),
          if (r.comment != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(r.comment!)),
          if (r.images.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.s),
              child: SizedBox(
                height: 56,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: r.images.length,
                  separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.xs),
                  itemBuilder: (_, i) => SizedBox(width: 56, child: CataloguePlate(child: Image.network(r.images[i].url, fit: BoxFit.cover))),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xs),
            child: Row(children: [
              Text(formatDate(r.createdAt), style: const TextStyle(color: AppTheme.slate, fontSize: 11)),
              const Spacer(),
              TextButton.icon(
                onPressed: () => _toggleHelpful(voted),
                icon: Icon(voted ? Icons.thumb_up : Icons.thumb_up_outlined, size: 14),
                label: Text('${r.helpfulCount}'),
                style: TextButton.styleFrom(visualDensity: VisualDensity.compact, padding: EdgeInsets.zero),
              ),
              if (r.replyCount > 0)
                TextButton(onPressed: () => setState(() => _showReplies = !_showReplies), child: Text('${r.replyCount} repl${r.replyCount == 1 ? 'y' : 'ies'}')),
              IconButton(icon: const Icon(Icons.flag_outlined, size: 16), onPressed: _report, visualDensity: VisualDensity.compact),
            ]),
          ),
          if (_showReplies) _RepliesThread(reviewId: r.id),
          const Divider(),
        ],
      ),
    );
  }
}

class _RepliesThread extends ConsumerWidget {
  const _RepliesThread({required this.reviewId});
  final int reviewId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(reviewThreadProvider(reviewId));
    return async.when(
      loading: () => const Padding(padding: EdgeInsets.all(AppSpacing.s), child: Center(child: CircularProgressIndicator())),
      error: (e, _) => const SizedBox.shrink(),
      data: (page) => Padding(
        padding: const EdgeInsets.only(left: AppSpacing.m, top: AppSpacing.xs),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final reply in page.results)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.s),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.subdirectory_arrow_right, size: 14, color: AppTheme.slate),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(reply.authorName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
                          if (reply.body != null) Text(reply.body!, style: const TextStyle(fontSize: 13)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
