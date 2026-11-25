import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/format/money.dart';
import '../data/dashboard_models.dart';

/// Sales (dark bars) and refunds (red bars) per day, or per month for 12 months.
/// Drawn by hand so the app needs no chart package.
class SalesChart extends StatelessWidget {
  const SalesChart({super.key, required this.series, required this.monthly});

  final List<SeriesPoint> series;
  final bool monthly;

  @override
  Widget build(BuildContext context) {
    final peak = series.fold<double>(0, (m, p) => p.grossSales > m ? p.grossSales : (p.refunds > m ? p.refunds : m));
    if (peak == 0) {
      return const SizedBox(height: 120, child: Center(child: Text('No sales or refunds in this period.', style: TextStyle(color: AppTheme.neutral))));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Highest ${monthly ? 'month' : 'day'}: ${formatUsd(peak)}', style: const TextStyle(color: AppTheme.neutral, fontSize: 13)),
        const SizedBox(height: AppSpacing.s),
        SizedBox(
          height: 140,
          width: double.infinity,
          child: CustomPaint(painter: _BarsPainter(series, peak)),
        ),
        const SizedBox(height: AppSpacing.xs),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(_label(series.first.date), style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
            Text(_label(series.last.date), style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
          ],
        ),
        const SizedBox(height: AppSpacing.s),
        const Row(children: [
          _Key(color: AppTheme.ink, text: 'Sales'),
          SizedBox(width: AppSpacing.m),
          _Key(color: AppTheme.danger, text: 'Refunds'),
        ]),
      ],
    );
  }

  static const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  String _label(String date) {
    final p = date.split('-');
    if (p.length < 2) return date;
    final month = _months[(int.tryParse(p[1]) ?? 1) - 1];
    return monthly ? '$month ${p[0]}' : '$month ${int.tryParse(p.length > 2 ? p[2] : '1')}';
  }
}

class _Key extends StatelessWidget {
  const _Key({required this.color, required this.text});
  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) => Row(children: [
        Container(width: 12, height: 12, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3))),
        const SizedBox(width: 6),
        Text(text, style: const TextStyle(fontSize: 13)),
      ]);
}

class _BarsPainter extends CustomPainter {
  _BarsPainter(this.series, this.peak);
  final List<SeriesPoint> series;
  final double peak;

  @override
  void paint(Canvas canvas, Size size) {
    final base = Paint()..color = AppTheme.border..strokeWidth = 1;
    canvas.drawLine(Offset(0, size.height), Offset(size.width, size.height), base);
    final slot = size.width / series.length;
    final bar = (slot * 0.34).clamp(1.0, 14.0);
    final sales = Paint()..color = AppTheme.ink;
    final refunds = Paint()..color = AppTheme.danger;
    for (var i = 0; i < series.length; i++) {
      final cx = slot * i + slot / 2;
      final s = series[i].grossSales / peak * size.height;
      final r = series[i].refunds / peak * size.height;
      if (s > 0) canvas.drawRect(Rect.fromLTWH(cx - bar, size.height - s, bar, s), sales);
      if (r > 0) canvas.drawRect(Rect.fromLTWH(cx, size.height - r, bar, r), refunds);
    }
  }

  @override
  bool shouldRepaint(_BarsPainter old) => old.series != series || old.peak != peak;
}
