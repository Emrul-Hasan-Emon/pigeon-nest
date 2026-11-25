import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:seller_app/features/dashboard/data/dashboard_models.dart';

Dashboard load(String name) => Dashboard(jsonDecode(File('test/fixtures/dashboard_$name.json').readAsStringSync()) as Map<String, dynamic>);

void main() {
  test('reads a seller with sales', () {
    final d = load('rahim');
    expect(d.monthly, true);
    expect(d.series.length, 12);
    expect(d.totals.grossSales, greaterThan(0));
    expect(d.ordersByStatus.length, 6);
    expect(d.topProducts, isNotEmpty);
    expect(d.attention.ordersToConfirm, isNonNegative);
    expect(d.balanceTotal, greaterThan(0));
    expect(d.wishlistTop, isNotEmpty);
  });

  test('reads reviews and a null change', () {
    final d = load('demo');
    expect(d.reviewCount, 4);
    expect(d.reviewAverage, isNotNull);
    expect(d.totals.changeSales, isNull);
  });

  test('empty json does not crash', () {
    final d = Dashboard(const {});
    expect(d.series, isEmpty);
    expect(d.totals.sellerEarnings, 0);
  });
}
