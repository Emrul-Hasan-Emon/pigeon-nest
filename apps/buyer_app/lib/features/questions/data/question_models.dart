class PublicQuestion {
  PublicQuestion({required this.id, required this.askerName, required this.question, required this.answer, required this.createdAt});
  final int id;
  final String askerName;
  final String question;
  final String? answer;
  final DateTime createdAt;

  factory PublicQuestion.fromJson(Map<String, dynamic> json) => PublicQuestion(
        id: json['id'] as int,
        askerName: json['askerName'] as String,
        question: json['question'] as String,
        answer: json['answer'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
