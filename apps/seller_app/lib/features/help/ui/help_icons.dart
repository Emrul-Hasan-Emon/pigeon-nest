import 'package:flutter/material.dart';

/// The website names its help icons (lucide, kebab case). These are the matching Material icons.
IconData helpIcon(String name) => switch (name) {
      'rocket' => Icons.rocket_launch_outlined,
      'house' => Icons.home_outlined,
      'receipt-text' => Icons.receipt_long_outlined,
      'package' => Icons.inventory_2_outlined,
      'credit-card' => Icons.credit_card,
      'mail-check' => Icons.mark_email_read_outlined,
      'landmark' => Icons.account_balance_outlined,
      'rotate-ccw' => Icons.assignment_return_outlined,
      'banknote' => Icons.currency_exchange,
      'hand-coins' => Icons.local_offer_outlined,
      'message-circle-question' => Icons.help_outline,
      'star' => Icons.star_outline,
      'heart' => Icons.favorite_border,
      'line-chart' => Icons.bar_chart_outlined,
      'file-text' => Icons.description_outlined,
      'coins' => Icons.percent,
      'user-round' => Icons.person_outline,
      _ => Icons.menu_book_outlined,
    };

/// Where a website path of a help topic ("Open my orders") goes in the app, or null when there is no such screen.
String? appRouteFor(String? websitePath) => switch (websitePath) {
      '/seller/dashboard' => '/?tab=0',
      '/seller/orders' => '/?tab=1',
      '/seller/products' => '/?tab=2',
      '/seller/payments' => '/more/payments',
      '/seller/payment-claims' => '/more/payment-claims',
      '/seller/payment-accounts' => '/more/payment-accounts',
      '/seller/returns' => '/more/returns',
      '/seller/refunds' => '/more/refunds',
      '/seller/offers' => '/more/offers',
      '/seller/questions' => '/more/questions',
      '/seller/reviews' => '/more/reviews',
      '/seller/wishlist' => '/more/wishlist',
      '/seller/reports' => '/more/reports',
      '/seller/statements' => '/more/statements',
      '/seller/commission' => '/more/commission',
      '/seller/profile' => '/more/profile',
      _ => null,
    };
