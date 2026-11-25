import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/format/money.dart';
import '../../../shared/format/text.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/attachment_strip.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/key_value.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/section_title.dart';
import '../data/payments_api.dart';

class PaymentDetailScreen extends ConsumerWidget {
  const PaymentDetailScreen({super.key, required this.paymentId});
  final int paymentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(paymentDetailProvider(paymentId));
    return Scaffold(
      appBar: AppBar(title: const Text('Payment')),
      body: data.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: ApiException.from(e).message, onRetry: () => ref.invalidate(paymentDetailProvider(paymentId))),
        data: (d) => ListView(padding: const EdgeInsets.all(AppSpacing.m), children: [
          AppCard(
            child: Column(children: [
              KeyValue('Order', d.row.orderNumber),
              KeyValue('Customer', d.row.customerName),
              KeyValue('Amount', formatUsd(d.row.amount), bold: true),
              if (d.row.paidAt != null) KeyValue('Received on', formatDateTime(d.row.paidAt!)),
              if (d.row.gatewayName != null) KeyValue('Method', d.row.gatewayName!),
              if (d.row.transactionId != null) KeyValue('Transaction', d.row.transactionId!),
              if (d.row.recordedBy != null) KeyValue('Recorded by', d.row.recordedBy!),
              if (d.row.reversed) KeyValue('Reversed', d.row.reversalReason ?? 'Yes', color: AppTheme.danger),
            ]),
          ),
          if (d.row.description != null) ...[const SizedBox(height: AppSpacing.m), AppCard(child: Text(d.row.description!))],
          if (d.attachments.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.m),
            AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const SectionTitle('Proof'), AttachmentStrip(d.attachments)])),
          ],
          const SizedBox(height: AppSpacing.m),
          AppCard(
            child: Column(children: [
              KeyValue('Order total', formatUsd(d.orderPayable)),
              KeyValue('Received so far', formatUsd(d.orderPaid)),
              KeyValue('Still due', formatUsd(d.orderDue), bold: true),
            ]),
          ),
          const SizedBox(height: AppSpacing.m),
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const SectionTitle('Payment history of this order'),
              for (final h in d.history)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${statusLabel(h.status)} · ${formatUsd(h.amount)} (paid ${formatUsd(h.amountPaidAfter)} after)', style: const TextStyle(fontWeight: FontWeight.w600)),
                    if (h.note != null) Text(h.note!),
                    Text('${h.by ?? ''} · ${formatDateTime(h.at)}', style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
                  ]),
                ),
            ]),
          ),
        ]),
      ),
    );
  }
}
