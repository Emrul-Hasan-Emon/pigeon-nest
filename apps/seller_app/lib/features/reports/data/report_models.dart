double _d(Object? v) => (v as num?)?.toDouble() ?? 0;
Map<String, dynamic> _m(Object? v) => (v as Map<String, dynamic>?) ?? const {};
List<Map<String, dynamic>> _l(Object? v) => [for (final e in (v as List? ?? const [])) e as Map<String, dynamic>];

/// A report as the server describes it: titled, with summary figures, columns and rows.
/// Every report has the same shape, so one screen shows them all.
class Report {
  Report(Map<String, dynamic> j)
      : title = j['title'] as String? ?? '',
        note = j['note'] as String? ?? '',
        from = j['from'] as String? ?? '',
        to = j['to'] as String? ?? '',
        summary = [for (final s in _l(j['summary'])) ReportFigure(s)],
        columns = [for (final c in _l(j['columns'])) ReportColumn(c)],
        rows = _l(j['rows']);
  final String title, note, from, to;
  final List<ReportFigure> summary;
  final List<ReportColumn> columns;
  final List<Map<String, dynamic>> rows;
}

class ReportFigure {
  ReportFigure(Map<String, dynamic> j)
      : label = j['label'] as String? ?? '',
        value = j['value'],
        kind = j['kind'] as String? ?? 'number';
  final String label, kind;
  final Object? value;
}

class ReportColumn {
  ReportColumn(Map<String, dynamic> j)
      : key = j['key'] as String? ?? '',
        label = j['label'] as String? ?? '',
        kind = j['kind'] as String? ?? 'text';
  final String key, label, kind;
}

class Statement {
  Statement(Map<String, dynamic> j)
      : month = j['month'] as String? ?? '',
        from = j['from'] as String? ?? '',
        to = j['to'] as String? ?? '',
        figures = {for (final e in _m(j['summary']).entries) e.key: _d(e.value)},
        orders = _l(j['orders']),
        refunds = _l(j['refunds']),
        payments = _l(j['payments']);
  final String month, from, to;
  final Map<String, double> figures;
  final List<Map<String, dynamic>> orders, refunds, payments;
}
