import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';

/// One entry in the More menu: a label, an icon, and where it goes.
class MoreMenuEntry {
  const MoreMenuEntry(this.label, this.icon, this.route);
  final String label;
  final IconData icon;
  final String route;
}

/// Grouped list of every section not already on the bottom bar (Dashboard,
/// Orders and Products have their own tab). Matches `FEATURES.md`'s phase
/// order, so a seller — or the next screen built — always has somewhere to
/// tap through to, even before that phase exists.
class MoreMenuScreen extends StatelessWidget {
  const MoreMenuScreen({super.key});

  static const _groups = <(String, List<MoreMenuEntry>)>[
    ('Account', [
      MoreMenuEntry('My profile', Icons.person_outline, '/more/profile'),
      MoreMenuEntry('Selling on or off', Icons.storefront_outlined, '/more/selling'),
      MoreMenuEntry('Change password', Icons.lock_outline, '/more/password'),
      MoreMenuEntry('Get your shop ready', Icons.checklist, '/more/checklist'),
    ]),
    ('Money', [
      MoreMenuEntry('Payments', Icons.payments_outlined, '/more/payments'),
      MoreMenuEntry('Paid requests', Icons.fact_check_outlined, '/more/payment-claims'),
      MoreMenuEntry('Payment accounts', Icons.account_balance_outlined, '/more/payment-accounts'),
      MoreMenuEntry('Returns', Icons.assignment_return_outlined, '/more/returns'),
      MoreMenuEntry('Refunds', Icons.currency_exchange, '/more/refunds'),
      MoreMenuEntry('System commission', Icons.percent, '/more/commission'),
      MoreMenuEntry('Statements', Icons.receipt_long_outlined, '/more/statements'),
      MoreMenuEntry('Reports', Icons.bar_chart_outlined, '/more/reports'),
    ]),
    ('Customers', [
      MoreMenuEntry('Price offers', Icons.local_offer_outlined, '/more/offers'),
      MoreMenuEntry('Questions', Icons.help_outline, '/more/questions'),
      MoreMenuEntry('Reviews', Icons.star_outline, '/more/reviews'),
      MoreMenuEntry('Wishlist insights', Icons.favorite_border, '/more/wishlist'),
    ]),
    ('Help', [
      MoreMenuEntry('Help topics', Icons.menu_book_outlined, '/more/help'),
    ]),
  ];

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.s),
      children: [
        for (final (title, entries) in _groups) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.m, AppSpacing.m, AppSpacing.m, AppSpacing.xs),
            child: Text(
              title,
              style: const TextStyle(color: AppTheme.neutral, fontWeight: FontWeight.w700, fontSize: 13),
            ),
          ),
          for (final entry in entries)
            ListTile(
              leading: Icon(entry.icon),
              title: Text(entry.label),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push(entry.route),
            ),
        ],
      ],
    );
  }
}
