import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:seller_app/features/help/data/help_models.dart';
import 'package:seller_app/features/help/ui/help_icons.dart';

dynamic load(String name) => jsonDecode(File('test/fixtures/$name.json').readAsStringSync());

void main() {
  test('a help topic keeps its sections and the five block kinds', () {
    final t = HelpTopic(load('help_orders'));
    expect(t.sections, isNotEmpty);
    const known = {'steps', 'words', 'points', 'faq', 'note'};
    for (final s in t.sections) {
      for (final b in s.blocks) {
        expect(known.contains(b.type), true, reason: b.type);
      }
    }
  });

  test('every topic "Open" path has a screen in the app', () {
    for (final t in load('help_topics')['topics'] as List) {
      final path = (t as Map<String, dynamic>)['openPath'] as String?;
      expect(appRouteFor(path), isNotNull, reason: path);
    }
  });
}
