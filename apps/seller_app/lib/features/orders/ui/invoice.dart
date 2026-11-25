import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../../../shared/format/date_format.dart';
import '../../../shared/format/money.dart';
import '../data/order_models.dart';
import '../../../shared/format/text.dart';

/// Builds the invoice as a PDF the seller can share or print.
Future<List<int>> buildInvoice(OrderDetail o, {required String shopName}) async {
  final doc = pw.Document();
  final bold = pw.TextStyle(fontWeight: pw.FontWeight.bold);
  pw.Widget row(String a, String b, {bool strong = false}) => pw.Padding(
        padding: const pw.EdgeInsets.symmetric(vertical: 2),
        child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
          pw.Text(a, style: strong ? bold : null),
          pw.Text(b, style: strong ? bold : null),
        ]),
      );

  doc.addPage(pw.MultiPage(
    pageFormat: PdfPageFormat.a4,
    margin: const pw.EdgeInsets.all(36),
    build: (_) => [
      pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
        pw.Text(shopName, style: pw.TextStyle(fontSize: 20, fontWeight: pw.FontWeight.bold)),
        pw.Text('INVOICE', style: pw.TextStyle(fontSize: 20, fontWeight: pw.FontWeight.bold)),
      ]),
      pw.SizedBox(height: 12),
      pw.Text('Order ${o.row.orderNumber}'),
      pw.Text('Date: ${formatDate(o.row.createdAt)}'),
      pw.Text('Status: ${statusLabel(o.row.status)}  /  Payment: ${statusLabel(o.row.paymentStatus)}'),
      pw.SizedBox(height: 14),
      pw.Text('Bill to', style: bold),
      pw.Text(o.recipient ?? o.row.customer.name),
      if (o.recipientPhone != null) pw.Text(o.recipientPhone!),
      for (final l in o.addressLines) pw.Text(l),
      pw.SizedBox(height: 16),
      pw.TableHelper.fromTextArray(
        headers: ['Item', 'Qty', 'Price', 'Total'],
        data: [
          for (final i in o.items)
            [
              [i.productName, if (i.skuLabel != null) i.skuLabel!, ...i.birdLines].join('\n'),
              '${i.quantity}',
              formatUsd(i.unitPayable),
              formatUsd(i.lineTotal),
            ],
        ],
        headerStyle: bold,
        cellAlignments: {1: pw.Alignment.centerRight, 2: pw.Alignment.centerRight, 3: pw.Alignment.centerRight},
        border: pw.TableBorder(bottom: const pw.BorderSide(width: 0.5)),
      ),
      pw.SizedBox(height: 12),
      pw.Align(
        alignment: pw.Alignment.centerRight,
        child: pw.SizedBox(width: 220, child: pw.Column(children: [
          row('Items', formatUsd(o.subtotal)),
          if (o.discountAmount > 0) row('Discount', '-${formatUsd(o.discountAmount)}'),
          row('Delivery', formatUsd(o.deliveryCharge)),
          pw.Divider(),
          row('Total', formatUsd(o.row.payable), strong: true),
          row('Received', formatUsd(o.row.amountPaid)),
          row('Balance due', formatUsd(o.balanceDue), strong: true),
        ])),
      ),
    ],
  ));
  return doc.save();
}

/// Opens the system share/print sheet with the invoice PDF.
Future<void> shareInvoice(BuildContext context, OrderDetail o, {String shopName = 'Pigeon Nest'}) async {
  try {
    final bytes = await buildInvoice(o, shopName: shopName);
    await Printing.sharePdf(bytes: Uint8List.fromList(bytes), filename: 'invoice-${o.row.orderNumber}.pdf');
  } catch (_) {
    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not make the invoice.')));
  }
}
