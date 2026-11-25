import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:seller_app/features/offers/data/offer_models.dart';
import 'package:seller_app/features/questions/data/question_models.dart';
import 'package:seller_app/features/reviews/data/review_models.dart';
import 'package:seller_app/features/wishlist/data/wishlist_models.dart';

dynamic load(String name) => jsonDecode(File('test/fixtures/$name.json').readAsStringSync());

void main() {
  test('an offer knows whose turn it is and what the seller may do', () {
    final o = Offer(load('offer_detail'));
    expect(o.awaitingYou, true);
    expect(o.actions, ['accept', 'counter', 'reject']);
    expect(o.history, isNotEmpty);
  });

  test('questions are answered or not', () {
    final qs = [for (final q in load('questions')['results'] as List) Question(q as Map<String, dynamic>)];
    expect(qs.any((q) => q.answered), true);
    expect(qs.any((q) => !q.answered), true);
  });

  test('review stars add up to the count', () {
    final s = ReviewSummary(load('review_summary'));
    expect(s.breakdown.values.fold(0, (a, b) => a + b), s.count);
  });

  test('a thread tells the seller\'s replies from the rest', () {
    final r = [for (final x in load('review_replies')['results'] as List) Reply(x as Map<String, dynamic>)];
    expect(r.any((x) => x.fromSeller), true);
  });

  test('wishlist insights list the most saved product first', () {
    final w = WishlistInsights(load('wishlist'));
    expect(w.top.first.saves, greaterThan(0));
  });
}
