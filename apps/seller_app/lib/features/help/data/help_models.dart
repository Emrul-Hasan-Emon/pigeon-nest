String? _s(Object? v) => (v is String && v.isNotEmpty) ? v : null;
List<Map<String, dynamic>> _l(Object? v) => [for (final e in (v as List? ?? const [])) e as Map<String, dynamic>];

/// One block of a help section. The server sends five kinds: steps, words, points, faq and note.
class HelpBlock {
  HelpBlock(Map<String, dynamic> j)
      : type = j['type'] as String? ?? '',
        title = _s(j['title']),
        tone = _s(j['tone']),
        text = _s(j['text']),
        items = _items(j);
  final String type;
  final String? title, tone, text;

  /// Each item as (main text, extra text). Steps: (text, detail). Words: (term, means). Points: (text, null). FAQ: (q, a).
  final List<(String, String?)> items;

  static List<(String, String?)> _items(Map<String, dynamic> j) {
    final out = <(String, String?)>[];
    for (final e in (j['steps'] ?? j['items'] ?? const []) as List) {
      if (e is String) {
        out.add((e, null));
      } else if (e is Map<String, dynamic>) {
        out.add(((e['text'] ?? e['term'] ?? e['q'] ?? '') as String, (e['detail'] ?? e['means'] ?? e['a']) as String?));
      }
    }
    return out;
  }
}

class HelpSection {
  HelpSection(Map<String, dynamic> j)
      : id = j['id'] as String? ?? '',
        title = j['title'] as String? ?? '',
        intro = _s(j['intro']),
        blocks = [for (final b in _l(j['blocks'])) HelpBlock(b)];
  final String id, title;
  final String? intro;
  final List<HelpBlock> blocks;
}

class HelpTopic {
  HelpTopic(Map<String, dynamic> j)
      : slug = j['slug'] as String? ?? '',
        title = j['title'] as String? ?? '',
        icon = j['icon'] as String? ?? '',
        summary = _s(j['summary']),
        openPath = _s(j['openPath']),
        openLabel = _s(j['openLabel']),
        sections = [for (final s in _l(j['sections'])) HelpSection(s)];
  final String slug, title, icon;
  final String? summary, openPath, openLabel;

  /// Empty in the topic list; filled when one topic is opened.
  final List<HelpSection> sections;
}
