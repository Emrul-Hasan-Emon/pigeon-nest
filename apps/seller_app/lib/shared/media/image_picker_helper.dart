import 'package:image_picker/image_picker.dart';

/// Picking a picture, one place, so every screen asks the same way (and the
/// same compression) whether it is a shop logo, a product photo or an ID image.
class ImagePickerHelper {
  ImagePickerHelper._();

  static final _picker = ImagePicker();

  static Future<XFile?> pickFromGallery({int imageQuality = 85}) =>
      _picker.pickImage(source: ImageSource.gallery, imageQuality: imageQuality);

  static Future<XFile?> pickFromCamera({int imageQuality = 85}) =>
      _picker.pickImage(source: ImageSource.camera, imageQuality: imageQuality);

  /// Several pictures at once, e.g. a product's media gallery.
  static Future<List<XFile>> pickMultipleFromGallery({int imageQuality = 85, int? limit}) =>
      _picker.pickMultiImage(imageQuality: imageQuality, limit: limit);
}
