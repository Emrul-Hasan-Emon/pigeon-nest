
import '../../../shared/widgets/status_badge.dart';
import '../../../shared/format/text.dart';

StatusTone orderTone(String s) => switch (s) {
      'delivered' => StatusTone.success,
      'cancelled' => StatusTone.danger,
      'pending' => StatusTone.warning,
      _ => StatusTone.info,
    };

StatusTone paymentTone(String s) => switch (s) {
      'paid' => StatusTone.success,
      'partially_paid' => StatusTone.warning,
      _ => StatusTone.neutral,
    };

/// The word on the button that moves an order into [status].
String moveLabel(String status) => switch (status) {
      'confirmed' => 'Confirm order',
      'packed' => 'Mark as packed',
      'shipped' => 'Mark as shipped',
      'delivered' => 'Mark as delivered',
      'cancelled' => 'Cancel order',
      _ => statusLabel(status),
    };



