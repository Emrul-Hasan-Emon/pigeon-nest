import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/format/money.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/attachment_strip.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/key_value.dart';
import '../../../shared/widgets/loading_view.dart';
import '../data/commission_api.dart';

class DisbursementScreen extends ConsumerWidget {
  const DisbursementScreen({super.key, required this.id});
  final int id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(disbursementProvider(id));
    return Scaffold(
      appBar: AppBar(title: const Text('Payment to the marketplace')),
      body: data.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: ApiException.from(e).message, onRetry: () => ref.invalidate(disbursementProvider(id))),
        data: (d) => ListView(padding: const EdgeInsets.all(AppSpacing.m), children: [
          AppCard(
            child: Column(children: [
              KeyValue('Date', formatDateTime(d.createdAt)),
              KeyValue('Amount', formatUsd(d.amount), bold: true),
              KeyValue('Still owed after this', formatUsd(d.dueAmount)),
              KeyValue('Paid in total', formatUsd(d.paidAmount)),
              if (d.recordedBy != null) KeyValue('Recorded by', d.recordedBy!),
            ]),
          ),
          if (d.notes != null) ...[const SizedBox(height: AppSpacing.m), AppCard(child: Text(d.notes!))],
          if (d.attachments.isNotEmpty) ...[const SizedBox(height: AppSpacing.m), AppCard(child: AttachmentStrip(d.attachments))],
        ]),
      ),
    );
  }
}
