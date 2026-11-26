import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

/// A signed-out buyer still has one cart per seller, kept against a random id
/// sent as `x-cart-session` (same contract as the website's guest cart:
/// 8-100 letters/digits/-/_). Generated once and kept on the phone; it is
/// never sent once the buyer is signed in — the server merges it into their
/// account carts/orders on login (`POST /carts/merge`).
class GuestSession {
  GuestSession._();
  static const _key = 'guest_cart_session';
  static String? _cached;

  static Future<String> id() async {
    final cached = _cached;
    if (cached != null) return cached;
    final prefs = await SharedPreferences.getInstance();
    var id = prefs.getString(_key);
    if (id == null) {
      id = const Uuid().v4().replaceAll('-', '');
      await prefs.setString(_key, id);
    }
    _cached = id;
    return id;
  }

  /// Called right after a successful guest-to-account merge, so a later
  /// guest visit on the same phone starts a fresh session rather than
  /// re-merging the same (by-then-empty) carts.
  static Future<void> reset() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
    _cached = null;
  }
}
