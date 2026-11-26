import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Spacing scale used everywhere instead of raw numbers, so the rhythm of the
/// app stays consistent. `m` is the usual gap between fields and sections.
class AppSpacing {
  AppSpacing._();

  static const xs = 4.0;
  static const s = 8.0;
  static const m = 16.0;
  static const l = 24.0;
  static const xl = 32.0;
}

/// The same catalogue identity as the website: a fine-livestock auction
/// catalogue, not a generic storefront. Fraunces carries headlines and lot
/// names; the body stays plain so prices and specs scan fast. Hairline
/// plates replace soft drop-shadow cards (`core/theme/app_theme.dart` on the
/// website is the same system — keep the two in step).
class AppTheme {
  AppTheme._();

  static const ink = Color(0xFF11151B);
  static const dove = Color(0xFFF2F3F3);
  static const paper = Color(0xFFFFFFFF);
  static const line = Color(0xFFDDE0E3);
  static const slate = Color(0xFF59636F);
  static const teal = Color(0xFF1F7F7A);
  static const brass = Color(0xFFB08A4A);
  static const danger = Color(0xFFCF4F4F);
  static const success = Color(0xFF1D7A73);
  static const warning = Color(0xFFC2932F);

  /// The hero's and wordmark's one signature accent — the neck-sheen
  /// gradient. Spend it once per screen; never repeat it as decoration.
  static const sheenA = Color(0xFF2AA6A0);
  static const sheenB = Color(0xFF7A5BD0);

  static TextTheme _textTheme(TextTheme base) {
    final serif = GoogleFonts.frauncesTextTheme(base);
    return base.copyWith(
      displayLarge: serif.displayLarge,
      displayMedium: serif.displayMedium,
      displaySmall: serif.displaySmall,
      headlineLarge: serif.headlineLarge,
      headlineMedium: serif.headlineMedium,
      headlineSmall: serif.headlineSmall,
      titleLarge: serif.titleLarge,
      titleMedium: serif.titleMedium,
    );
  }

  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(seedColor: ink, brightness: Brightness.light).copyWith(
      primary: ink,
      onPrimary: dove,
      secondary: teal,
      tertiary: brass,
      surface: paper,
      error: danger,
    );
    final base = Typography.blackMountainView.apply(bodyColor: ink, displayColor: ink);
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: dove,
      splashFactory: InkSparkle.splashFactory,
      appBarTheme: AppBarTheme(
        backgroundColor: ink,
        foregroundColor: dove,
        elevation: 0,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: GoogleFonts.fraunces(color: dove, fontSize: 22, fontWeight: FontWeight.w600, letterSpacing: 0.1),
        iconTheme: const IconThemeData(color: dove),
      ),
      dividerTheme: const DividerThemeData(color: line, thickness: 1, space: 1),
      cardTheme: CardThemeData(
        color: paper,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: const BorderSide(color: line)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: line)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: line)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: teal, width: 1.4)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: ink,
          foregroundColor: dove,
          minimumSize: const Size.fromHeight(52),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, letterSpacing: 0.2),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: ink,
          side: const BorderSide(color: ink, width: 1.2),
          minimumSize: const Size.fromHeight(52),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: teal, textStyle: const TextStyle(fontWeight: FontWeight.w600)),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: dove,
        selectedColor: ink,
        labelStyle: const TextStyle(color: ink, fontWeight: FontWeight.w600, fontSize: 13),
        secondaryLabelStyle: const TextStyle(color: dove, fontWeight: FontWeight.w600, fontSize: 13),
        side: const BorderSide(color: line),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: paper,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        titleTextStyle: GoogleFonts.fraunces(color: ink, fontSize: 20, fontWeight: FontWeight.w600),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: ink,
        contentTextStyle: const TextStyle(color: dove),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: paper,
        surfaceTintColor: Colors.transparent,
        indicatorColor: brass.withValues(alpha: 0.16),
        height: 68,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontSize: 11.5,
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
            color: states.contains(WidgetState.selected) ? ink : slate,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(color: states.contains(WidgetState.selected) ? ink : slate, size: 24),
        ),
      ),
      textTheme: _textTheme(base),
    );
  }
}
