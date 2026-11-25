/// The app's one money formatter. Pigeon Nest only handles USD for now
/// (root `rules.md` rule 9) — when another currency is added, this is the
/// only place that needs to change.
String formatUsd(num amount) {
  final negative = amount < 0;
  final fixed = amount.abs().toStringAsFixed(2);
  final dot = fixed.indexOf('.');
  final whole = fixed.substring(0, dot);
  final decimals = fixed.substring(dot + 1);

  final grouped = StringBuffer();
  for (var i = 0; i < whole.length; i++) {
    final fromEnd = whole.length - i;
    if (i > 0 && fromEnd % 3 == 0) grouped.write(',');
    grouped.write(whole[i]);
  }

  return '${negative ? '-' : ''}\$$grouped.$decimals';
}
