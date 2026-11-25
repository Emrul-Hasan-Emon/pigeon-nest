import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:seller_app/features/orders/data/order_models.dart';

Map<String, dynamic> load(String name) => jsonDecode(File('test/fixtures/$name.json').readAsStringSync()) as Map<String, dynamic>;

void main() {
  test('reads the order list', () {
    final rows = [for (final r in load('order_list')['results']) OrderRow(r as Map<String, dynamic>)];
    expect(rows, isNotEmpty);
    expect(rows.first.orderNumber, startsWith('PN'));
  });

  test('reads an order with a part payment, a reversed receipt and an update', () {
    final d = OrderDetail(load('order_full'));
    expect(d.subtotal, 900);
    expect(d.balanceDue, 599.5);
    expect(d.payments.length, 2);
    expect(d.payments.where((p) => p.reversed).length, 1);
    // Receipts carry the order's payment state, so "received" is partially_paid or paid.
    expect(d.payments.where((p) => p.canReverse).length, 1);
    expect(d.updates.single.attachments.length, 1);
    expect(d.canRecordPayment, true);
  });
}
