import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:seller_app/features/products/data/product_models.dart';
import 'package:seller_app/features/products/data/sku_draft.dart';

Map<String, dynamic> load(String name) => jsonDecode(File('test/fixtures/$name.json').readAsStringSync()) as Map<String, dynamic>;

void main() {
  test('reads a product with options, a parent and pictures', () {
    final d = ProductDetail(load('product_detail'));
    expect(d.skus.length, 3);
    expect(d.skus.first.onOffer, true);
    expect(d.skus.first.parent('dam')?.name, 'Luna');
    expect(d.media, isNotEmpty);
  });

  test('an update keeps the option code and choices out of the payload', () {
    final draft = SkuDraft.fromSku(ProductDetail(load('product_detail')).skus.first);
    final json = draft.toUpdateJson();
    expect(json.containsKey('variants'), false);
    expect(json.containsKey('sku'), false);
    expect(json['discountedPrice'], 3200);
  });

  test('an empty offer price is sent as the normal price', () {
    final d = SkuDraft(price: '80', variants: [(2, 7, 'Gender: Female')]);
    expect(d.toCreateJson()['discountedPrice'], 80.0);
    expect(SkuDraft(price: '10', offerPrice: '20', variants: [(1, 1, 'x')]).problem(), 'The offer price cannot be above the price.');
  });

  test('age text', () {
    expect(ageText('2026-03-01', today: DateTime(2026, 11, 25)), '8 months old');
    expect(ageText('2026-11-20', today: DateTime(2026, 11, 25)), '5 days old');
    expect(ageText(null), '');
  });
}
