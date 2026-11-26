import '../../../shared/widgets/status_badge.dart';

StatusTone orderStatusTone(String status) => switch (status) {
      'delivered' => StatusTone.success,
      'cancelled' => StatusTone.danger,
      'pending' => StatusTone.warning,
      _ => StatusTone.info,
    };

StatusTone paymentStatusTone(String status) => switch (status) {
      'paid' => StatusTone.success,
      'partially_paid' => StatusTone.warning,
      _ => StatusTone.neutral,
    };
