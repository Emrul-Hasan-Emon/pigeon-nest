import '../../../core/config/app_config.dart';

String? _media(String? url) => url == null ? null : AppConfig.mediaUrl(url);

class ReviewImage {
  ReviewImage({required this.id, required this.url});
  final int id;
  final String url;

  factory ReviewImage.fromJson(Map<String, dynamic> json) => ReviewImage(id: json['id'] as int, url: _media(json['url'] as String) ?? json['url'] as String);
}

class RatingSummary {
  RatingSummary({required this.ratingAverage, required this.ratingCount, required this.breakdown});
  final num ratingAverage;
  final int ratingCount;
  final Map<String, int> breakdown;

  factory RatingSummary.fromJson(Map<String, dynamic> json) => RatingSummary(
        ratingAverage: (json['ratingAverage'] as num?) ?? 0,
        ratingCount: (json['ratingCount'] as num?)?.toInt() ?? 0,
        breakdown: (json['breakdown'] as Map<String, dynamic>? ?? {}).map((k, v) => MapEntry(k, (v as num).toInt())),
      );
}

class PublicReview {
  PublicReview({
    required this.id,
    required this.rating,
    required this.title,
    required this.comment,
    required this.images,
    required this.reviewerName,
    required this.verifiedPurchase,
    required this.helpfulCount,
    required this.replyCount,
    required this.createdAt,
  });
  final int id;
  final int rating;
  final String? title;
  final String? comment;
  final List<ReviewImage> images;
  final String reviewerName;
  final bool verifiedPurchase;
  final int helpfulCount;
  final int replyCount;
  final DateTime createdAt;

  factory PublicReview.fromJson(Map<String, dynamic> json) => PublicReview(
        id: json['id'] as int,
        rating: json['rating'] as int,
        title: json['title'] as String?,
        comment: json['comment'] as String?,
        images: (json['images'] as List).cast<Map<String, dynamic>>().map(ReviewImage.fromJson).toList(),
        reviewerName: json['reviewerName'] as String,
        verifiedPurchase: json['verifiedPurchase'] as bool? ?? false,
        helpfulCount: (json['helpfulCount'] as num?)?.toInt() ?? 0,
        replyCount: (json['replyCount'] as num?)?.toInt() ?? 0,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

class PendingReviewItem {
  PendingReviewItem({required this.id, required this.orderNumber, required this.productId, required this.productName, required this.thumbnailUrl});
  final int id;
  final String orderNumber;
  final int productId;
  final String productName;
  final String? thumbnailUrl;

  factory PendingReviewItem.fromJson(Map<String, dynamic> json) => PendingReviewItem(
        id: json['id'] as int,
        orderNumber: json['orderNumber'] as String,
        productId: json['productId'] as int,
        productName: json['productName'] as String,
        thumbnailUrl: _media(json['thumbnailUrl'] as String?),
      );
}

class MyReview {
  MyReview({
    required this.id,
    required this.productId,
    required this.productName,
    required this.productThumbnailUrl,
    required this.rating,
    required this.title,
    required this.comment,
    required this.images,
    required this.status,
    required this.hiddenReason,
    required this.createdAt,
    required this.editableUntil,
    required this.canEdit,
  });
  final int id;
  final int productId;
  final String? productName;
  final String? productThumbnailUrl;
  final int rating;
  final String? title;
  final String? comment;
  final List<ReviewImage> images;
  final String status;
  final String? hiddenReason;
  final DateTime createdAt;
  final DateTime editableUntil;
  final bool canEdit;

  factory MyReview.fromJson(Map<String, dynamic> json) {
    final product = json['product'] as Map<String, dynamic>;
    return MyReview(
      id: json['id'] as int,
      productId: product['id'] as int,
      productName: product['name'] as String?,
      productThumbnailUrl: _media(product['thumbnailUrl'] as String?),
      rating: json['rating'] as int,
      title: json['title'] as String?,
      comment: json['comment'] as String?,
      images: (json['images'] as List).cast<Map<String, dynamic>>().map(ReviewImage.fromJson).toList(),
      status: json['status'] as String,
      hiddenReason: json['hiddenReason'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      editableUntil: DateTime.parse(json['editableUntil'] as String),
      canEdit: json['canEdit'] as bool,
    );
  }
}

class ReviewReply {
  ReviewReply({required this.id, required this.authorType, required this.authorName, required this.body, required this.createdAt});
  final int id;
  final String authorType;
  final String authorName;
  final String? body;
  final DateTime createdAt;

  factory ReviewReply.fromJson(Map<String, dynamic> json) => ReviewReply(
        id: json['id'] as int,
        authorType: json['authorType'] as String,
        authorName: json['authorName'] as String,
        body: json['body'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
