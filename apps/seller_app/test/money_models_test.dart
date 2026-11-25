import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:seller_app/features/commission/data/commission_models.dart';
import 'package:seller_app/features/payments/data/payment_models.dart';
import 'package:seller_app/features/reports/data/report_models.dart';
import 'package:seller_app/features/reports/ui/report_view.dart';
import 'package:seller_app/features/returns/data/return_models.dart';

dynamic load(String name) => jsonDecode(File('test/fixtures/$name.json').readAsStringSync());

void main() {
  test('payments, paid requests and accounts', () {
    expect(PaymentDetail(load('payment_detail')).attachments.length, 1);
    final claim = Claim((load('claims')['results'] as List).first as Map<String, dynamic>);
    expect(claim.attachments.first.url, contains('payment-claims')); // claims call the address `fileUrl`
    expect([for (final a in load('accounts') as List) PayAccount(a as Map<String, dynamic>)].any((a) => a.isBank), true);
  });

  test('a return shows the seller its next steps and the money records', () {
    final d = ReturnDetail(load('return_detail'));
    expect(d.sellerNext, contains('returning_money'));
    expect(d.row.refundAmount, 10500);
    expect(d.moneyRecords.single.proof.length, 1);
  });

  test('a refund moves one step at a time', () {
    final rows = [for (final r in load('refunds')['results'] as List) RefundRecord(r as Map<String, dynamic>)];
    expect(rows.firstWhere((r) => r.status == 'needs_to_refund').next, 'processing');
    expect(rows.firstWhere((r) => r.status == 'refunded').next, isNull);
  });

  test('commission adds up and reads its rate', () {
    final b = CommissionBalance(load('commission_balance'));
    expect(b.total - b.paid - b.due, closeTo(0, 0.005));
    expect(rateText(b.rateType, b.rateValue), '10%');
    expect(rateText('fixed', 3.33), '\$3.33 per line');
  });

  test('the statement adds up to what the seller keeps', () {
    final f = Statement(load('statement')).figures;
    expect(f['sales']! - f['systemCommission']! - f['refunds']! + f['systemCommissionGivenBack']!, closeTo(f['youKeep']!, 0.005));
  });

  test('reports are shown by kind', () {
    expect(Report(load('report_sales')).rows, isNotEmpty);
    expect(reportValue('money', 192.2), '\$192.20');
    expect(reportValue('percent', 17.6), '17.60%');
    expect(reportValue('number', 3), '3');
  });
}
