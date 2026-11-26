import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Keeps the buyer's access token in the phone's secure storage (Keychain on iOS, Keystore on Android).
class TokenStore {
  TokenStore([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  static const _key = 'user_access_token';
  final FlutterSecureStorage _storage;

  Future<String?> read() => _storage.read(key: _key);
  Future<void> write(String token) => _storage.write(key: _key, value: token);
  Future<void> clear() => _storage.delete(key: _key);
}
