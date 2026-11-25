/// A proof picture or file. Orders call the address `url`, refunds and claims call it `fileUrl`.
class Attachment {
  Attachment(Map<String, dynamic> j)
      : fileName = j['fileName'] as String? ?? 'file',
        url = (j['url'] ?? j['fileUrl']) as String? ?? '',
        kind = j['kind'] as String? ?? 'file';
  final String fileName, url, kind;
  bool get isImage => kind == 'image';

  static List<Attachment> list(Object? v) => [for (final e in (v as List? ?? const [])) Attachment(e as Map<String, dynamic>)];
}
