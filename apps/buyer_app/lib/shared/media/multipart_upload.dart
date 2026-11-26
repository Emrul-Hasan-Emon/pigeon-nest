import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';

/// Builds the multipart body the server's uploads expect: plain fields plus
/// one or more picked files under a field name (e.g. `avatar`, `images`).
/// Pass the result straight to `ApiClient.post`/`patch` — it already accepts
/// any body, [FormData] included.
Future<FormData> buildMultipart({
  Map<String, dynamic> fields = const {},
  Map<String, XFile> singleFiles = const {},
  Map<String, List<XFile>> multiFiles = const {},
}) async {
  final map = <String, dynamic>{...fields};
  for (final entry in singleFiles.entries) {
    map[entry.key] = await MultipartFile.fromFile(entry.value.path, filename: entry.value.name);
  }
  for (final entry in multiFiles.entries) {
    map[entry.key] = [
      for (final file in entry.value) await MultipartFile.fromFile(file.path, filename: file.name),
    ];
  }
  return FormData.fromMap(map);
}
