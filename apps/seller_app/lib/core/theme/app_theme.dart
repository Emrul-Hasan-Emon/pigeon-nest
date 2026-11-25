import 'package:flutter/material.dart';

/// Big, plain and easy to tap: the same feel as the seller website.
class AppTheme {
  AppTheme._();

  static const ink = Color(0xFF1C1917);
  static const paper = Color(0xFFFBF9F6);
  static const danger = Color(0xFFD92D20);

  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(seedColor: ink, brightness: Brightness.light).copyWith(
      primary: ink,
      onPrimary: paper,
      surface: paper,
      error: danger,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: paper,
      appBarTheme: const AppBarTheme(backgroundColor: paper, foregroundColor: ink, elevation: 0, centerTitle: false),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(56),
          textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      textTheme: Typography.blackMountainView.apply(bodyColor: ink, displayColor: ink),
    );
  }
}
