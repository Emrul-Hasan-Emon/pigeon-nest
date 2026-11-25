String? _s(Object? v) => (v is String && v.isNotEmpty) ? v : null;
Map<String, dynamic> _m(Object? v) => (v as Map<String, dynamic>?) ?? const {};
DateTime? _t(Object? v) => v == null ? null : DateTime.tryParse(v as String);

/// A buyer's question on one of the seller's products.
class Question {
  Question(Map<String, dynamic> j)
      : id = (j['id'] as num).toInt(),
        productName = _s(_m(j['product'])['name']) ?? '',
        askerName = _s(j['askerName']) ?? 'Buyer',
        question = j['question'] as String? ?? '',
        answer = _s(j['answer']),
        answeredAt = _t(j['answeredAt']),
        hidden = j['status'] == 'hidden',
        hiddenReason = _s(j['hiddenReason']),
        createdAt = _t(j['createdAt']) ?? DateTime.fromMillisecondsSinceEpoch(0);
  final int id;
  final String productName, askerName, question;
  final String? answer, hiddenReason;
  final DateTime? answeredAt;
  final DateTime createdAt;
  final bool hidden;
  bool get answered => answer != null;
}
