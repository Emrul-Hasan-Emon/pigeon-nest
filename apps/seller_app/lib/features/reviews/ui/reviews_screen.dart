import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/cursor_list.dart';
import '../../../shared/widgets/image_thumb.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/review_models.dart';
import '../data/reviews_api.dart';

class Stars extends StatelessWidget {
  const Stars(this.rating, {super.key, this.size = 18});
  final int rating;
  final double size;

  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        for (var i = 1; i <= 5; i++) Icon(i <= rating ? Icons.star : Icons.star_border, size: size, color: AppTheme.warning),
      ]);
}

class ReviewsScreen extends ConsumerStatefulWidget {
  const ReviewsScreen({super.key});

  @override
  ConsumerState<ReviewsScreen> createState() => _ReviewsScreenState();
}

class _ReviewsScreenState extends ConsumerState<ReviewsScreen> {
  int? _rating;
  bool _unreplied = false;
  int _version = 0;

  @override
  Widget build(BuildContext context) {
    final sum = ref.watch(reviewSummaryProvider).value;
    return Scaffold(
      appBar: AppBar(title: const Text('Reviews')),
      body: Column(children: [
        if (sum != null)
          Padding(
            padding: const EdgeInsets.all(AppSpacing.m),
            child: AppCard(
              child: Row(children: [
                Column(children: [
                  Text(sum.count == 0 ? '-' : sum.average.toStringAsFixed(1), style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800)),
                  Text('${sum.count} reviews', style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
                ]),
                const SizedBox(width: AppSpacing.m),
                Expanded(
                  child: Column(children: [
                    for (var s = 5; s >= 1; s--)
                      Row(children: [
                        Text('$s', style: const TextStyle(fontSize: 12)),
                        const SizedBox(width: 6),
                        Expanded(child: LinearProgressIndicator(value: sum.count == 0 ? 0 : (sum.breakdown[s] ?? 0) / sum.count, color: AppTheme.warning, backgroundColor: AppTheme.border, minHeight: 6)),
                        const SizedBox(width: 6),
                        SizedBox(width: 22, child: Text('${sum.breakdown[s] ?? 0}', style: const TextStyle(fontSize: 12))),
                      ]),
                  ]),
                ),
              ]),
            ),
          ),
        SizedBox(
          height: 44,
          child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m), children: [
            Padding(
              padding: const EdgeInsets.only(right: AppSpacing.s),
              child: FilterChip(label: Text(sum == null ? 'Not answered' : 'Not answered (${sum.unreplied})'), selected: _unreplied, onSelected: (v) => setState(() => _unreplied = v)),
            ),
            for (final (label, value) in const [('All stars', null), ('5', 5), ('4', 4), ('3', 3), ('2', 2), ('1', 1)])
              Padding(padding: const EdgeInsets.only(right: AppSpacing.s), child: ChoiceChip(label: Text(value == null ? label : '$label ★'), selected: _rating == value, onSelected: (_) => setState(() => _rating = value))),
          ]),
        ),
        Expanded(
          child: CursorList<Review>(
            fetch: ref.read(reviewsApiProvider).listFetcher(rating: _rating, unreplied: _unreplied),
            reloadKey: '$_rating|$_unreplied|$_version',
            emptyText: 'No reviews here.',
            emptyIcon: Icons.star_outline,
            itemBuilder: (context, r) => AppCard(
              onTap: () async {
                await context.push('/more/reviews/${r.id}', extra: r);
                ref.invalidate(reviewSummaryProvider);
                if (mounted) setState(() => _version++);
              },
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [Stars(r.rating), const Spacer(), Text(formatDate(r.createdAt), style: const TextStyle(color: AppTheme.neutral, fontSize: 12))]),
                Text(r.productName, style: const TextStyle(color: AppTheme.neutral, fontSize: 13)),
                if (r.title != null) Text(r.title!, style: const TextStyle(fontWeight: FontWeight.w700)),
                if (r.comment != null) Text(r.comment!),
                if (r.imageUrls.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Wrap(spacing: 6, children: [for (final u in r.imageUrls) ImageThumb(u, size: 56)])),
                const SizedBox(height: AppSpacing.xs),
                Row(children: [
                  Text(r.reviewerName, style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
                  const Spacer(),
                  StatusBadge(label: r.sellerReplied ? 'Answered' : 'Not answered', tone: r.sellerReplied ? StatusTone.success : StatusTone.warning),
                ]),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}
