double _d(Object? v) => (v as num?)?.toDouble() ?? 0;
int _i(Object? v) => (v as num?)?.toInt() ?? 0;
String? _s(Object? v) => (v is String && v.isNotEmpty) ? v : null;
DateTime _t(Object? v) => DateTime.tryParse(v as String? ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0);

const reportReasons = {'spam': 'Spam', 'abusive': 'Abusive', 'fake': 'Fake', 'irrelevant': 'Not about the product', 'other': 'Other'};

class Review {
  Review(Map<String, dynamic> j)
      : id = _i(j['id']),
        productName = j['productName'] as String? ?? '',
        rating = _i(j['rating']),
        title = _s(j['title']),
        comment = _s(j['comment']),
        imageUrls = [for (final i in (j['images'] as List? ?? const [])) (i as Map<String, dynamic>)['url'] as String],
        reviewerName = _s(j['reviewerName']) ?? 'Buyer',
        helpfulCount = _i(j['helpfulCount']),
        replyCount = _i(j['replyCount']),
        sellerReplied = j['sellerReplied'] as bool? ?? false,
        createdAt = _t(j['createdAt']);
  final int id, rating, helpfulCount, replyCount;
  final String productName, reviewerName;
  final String? title, comment;
  final List<String> imageUrls;
  final bool sellerReplied;
  final DateTime createdAt;
}

class ReviewSummary {
  ReviewSummary(Map<String, dynamic> j)
      : count = _i(j['ratingCount']),
        average = _d(j['ratingAverage']),
        unreplied = _i(j['unreplied']),
        breakdown = {for (final e in ((j['breakdown'] as Map<String, dynamic>?) ?? const {}).entries) int.parse(e.key): _i(e.value)};
  final int count, unreplied;
  final double average;
  final Map<int, int> breakdown;
}

/// One reply in a review's thread. `replyCount` counts the replies under this one.
class Reply {
  Reply(Map<String, dynamic> j)
      : id = _i(j['id']),
        parentId = j['parentId'] as int?,
        authorType = j['authorType'] as String? ?? '',
        authorName = _s(j['authorName']) ?? '',
        replyToName = _s(j['replyToName']),
        body = _s(j['body']) ?? '',
        hidden = j['hidden'] as bool? ?? false,
        deleted = j['deleted'] as bool? ?? false,
        replyCount = _i(j['replyCount']),
        createdAt = _t(j['createdAt']);
  final int id, replyCount;
  final int? parentId;
  final String authorType, authorName, body;
  final String? replyToName;
  final bool hidden, deleted;
  final DateTime createdAt;
  bool get fromSeller => authorType == 'seller';
}
