import '../../../core/auth/seller_access.dart';

/// The seller's own account, as `GET /profile` returns it.
class SellerProfile {
  const SellerProfile({
    required this.name,
    required this.phone,
    required this.access,
    this.email,
    this.description,
    this.avatarUrl,
    this.nidFrontUrl,
    this.nidBackUrl,
    this.isEnabledForSell = true,
    this.breakStartsOn,
    this.breakEndsOn,
    this.breakNote,
    this.status,
  });

  final String name;
  final String phone;
  final String? email;
  final String? description;
  final String? avatarUrl;
  final String? nidFrontUrl;
  final String? nidBackUrl;
  final bool isEnabledForSell;
  final String? breakStartsOn; // yyyy-mm-dd
  final String? breakEndsOn;
  final String? breakNote;
  final String? status;
  final SellerAccess access;

  bool get hasBreak => breakStartsOn != null && breakEndsOn != null;

  static String? _text(Object? v) => (v is String && v.isNotEmpty) ? v : null;

  factory SellerProfile.fromJson(Map<String, dynamic> j) => SellerProfile(
        name: j['name'] as String? ?? '',
        phone: j['phone'] as String? ?? '',
        email: _text(j['email']),
        description: _text(j['description']),
        avatarUrl: _text(j['avatarUrl']),
        nidFrontUrl: _text(j['nidFrontImageUrl']),
        nidBackUrl: _text(j['nidBackImageUrl']),
        isEnabledForSell: j['isEnabledForSell'] as bool? ?? true,
        breakStartsOn: _text(j['breakStartsOn']),
        breakEndsOn: _text(j['breakEndsOn']),
        breakNote: _text(j['breakNote']),
        status: _text(j['status']),
        access: SellerAccess.fromJson(j['access'] as Map<String, dynamic>?),
      );
}

class OnboardingStep {
  const OnboardingStep({required this.key, required this.label, required this.hint, required this.done});
  final String key;
  final String label;
  final String hint;
  final bool done;

  factory OnboardingStep.fromJson(Map<String, dynamic> j) => OnboardingStep(
        key: j['key'] as String,
        label: j['label'] as String,
        hint: j['hint'] as String? ?? '',
        done: j['done'] as bool? ?? false,
      );
}

/// The "get your shop ready" checklist.
class Onboarding {
  const Onboarding({required this.steps, required this.done, required this.total, required this.percent});
  final List<OnboardingStep> steps;
  final int done;
  final int total;
  final int percent;

  bool get complete => done >= total;

  factory Onboarding.fromJson(Map<String, dynamic> j) => Onboarding(
        steps: [for (final s in (j['steps'] as List)) OnboardingStep.fromJson(s as Map<String, dynamic>)],
        done: j['done'] as int? ?? 0,
        total: j['total'] as int? ?? 0,
        percent: j['percent'] as int? ?? 0,
      );
}
