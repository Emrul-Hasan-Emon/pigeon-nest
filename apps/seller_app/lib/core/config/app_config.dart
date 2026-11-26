import 'dart:io' show Platform;

/// Where the server lives.
///
/// Override at build time:
///   flutter run --dart-define=API_BASE_URL=https://api.example.com/v1/api
class AppConfig {
  AppConfig._();

  static const _fromEnv = String.fromEnvironment('API_BASE_URL');

  /// The Android emulator reaches your computer at 10.0.2.2; the iOS simulator at localhost.
  static String get apiBaseUrl {
    if (_fromEnv.isNotEmpty) return _fromEnv;
    final host = Platform.isAndroid ? '10.0.2.2' : 'localhost';
    return 'http://$host:3100/v1/api';
  }

  /// Every seller route lives under this prefix.
  static String get sellerApi => '$apiBaseUrl/seller';

  /// The dev server writes picture addresses with its own name (`http://localhost:3100/...`), which a phone or
  /// emulator cannot reach. They are pointed at the server address the app was started with.
  /// A real server sends public addresses, and those are left alone.
  static String mediaUrl(String url) {
    final api = Uri.parse(apiBaseUrl);
    final u = Uri.tryParse(url);
    if (u == null || (u.host != 'localhost' && u.host != '127.0.0.1')) return url;
    return u.replace(scheme: api.scheme, host: api.host, port: api.hasPort ? api.port : null).toString();
  }
}
