/// `partially_paid` -> `Partially paid`.
String statusLabel(String s) {
  final t = s.replaceAll('_', ' ');
  return t[0].toUpperCase() + t.substring(1);
}
