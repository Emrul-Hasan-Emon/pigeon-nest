const _months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/// `Jan 5, 2026`. Always the local (device) time, since that is what the
/// buyer is looking at their phone in.
String formatDate(DateTime date) {
  final local = date.toLocal();
  return '${_months[local.month - 1]} ${local.day}, ${local.year}';
}

/// `Jan 5, 2026, 2:46 PM`.
String formatDateTime(DateTime date) {
  final local = date.toLocal();
  final hour24 = local.hour;
  final period = hour24 >= 12 ? 'PM' : 'AM';
  final hour12 = hour24 % 12 == 0 ? 12 : hour24 % 12;
  final minute = local.minute.toString().padLeft(2, '0');
  return '${formatDate(date)}, $hour12:$minute $period';
}
