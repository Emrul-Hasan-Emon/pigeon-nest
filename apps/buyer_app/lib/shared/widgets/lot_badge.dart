import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// A lot number, set like a plate caption — only ever the item's real
/// position in the list it is shown in (page offset + index), never
/// decorative. Matches the website's `.store-lot`.
class LotBadge extends StatelessWidget {
  const LotBadge({super.key, required this.number});

  final int number;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xD6111B21),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18), width: 0.6),
      ),
      constraints: const BoxConstraints(minWidth: 26),
      child: Text(
        '$number',
        textAlign: TextAlign.center,
        style: GoogleFonts.fraunces(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 0.2),
      ),
    );
  }
}
