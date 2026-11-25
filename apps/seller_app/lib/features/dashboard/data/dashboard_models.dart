double _d(Object? v) => (v as num?)?.toDouble() ?? 0;
int _i(Object? v) => (v as num?)?.toInt() ?? 0;
Map<String, dynamic> _m(Object? v) => (v as Map<String, dynamic>?) ?? const {};

/// How far back the dashboard looks. [value] is what the API expects.
enum DashboardRange {
  week('7d', '7 days'),
  month('30d', '30 days'),
  quarter('90d', '90 days'),
  year('12m', '12 months');

  const DashboardRange(this.value, this.label);
  final String value;
  final String label;
}

/// Percent against the period before; null when that period had nothing.
double? _change(Object? v) => (v as num?)?.toDouble();

class DashboardTotals {
  DashboardTotals(Map<String, dynamic> j)
      : placed = _i(_m(j['orders'])['placed']),
        paid = _i(_m(j['orders'])['paid']),
        delivered = _i(_m(j['orders'])['delivered']),
        cancelled = _i(_m(j['orders'])['cancelled']),
        grossSales = _d(j['grossSales']),
        refundCount = _i(_m(j['refunds'])['count']),
        refundAmount = _d(_m(j['refunds'])['amount']),
        netSales = _d(j['netSales']),
        averageOrder = _d(j['averageOrder']),
        commissionNet = _d(_m(j['commission'])['net']),
        sellerEarnings = _d(j['sellerEarnings']),
        returnRate = _d(j['returnRate']),
        changeOrders = _change(_m(j['change'])['orders']),
        changePaidOrders = _change(_m(j['change'])['paidOrders']),
        changeSales = _change(_m(j['change'])['grossSales']),
        changeAverage = _change(_m(j['change'])['averageOrder']),
        changeCommission = _change(_m(j['change'])['netCommission']),
        changeEarnings = _change(_m(j['change'])['sellerEarnings']);

  final int placed, paid, delivered, cancelled, refundCount;
  final double grossSales, refundAmount, netSales, averageOrder, commissionNet, sellerEarnings, returnRate;
  final double? changeOrders, changePaidOrders, changeSales, changeAverage, changeCommission, changeEarnings;
}

class SeriesPoint {
  SeriesPoint(Map<String, dynamic> j)
      : date = j['date'] as String? ?? '',
        grossSales = _d(j['grossSales']),
        refunds = _d(j['refunds']);
  final String date;
  final double grossSales, refunds;
}

class StatusCount {
  StatusCount(Map<String, dynamic> j)
      : status = j['status'] as String? ?? '',
        count = _i(j['count']);
  final String status;
  final int count;
}

class TopProduct {
  TopProduct(Map<String, dynamic> j)
      : id = _i(j['id']),
        name = j['name'] as String? ?? '',
        units = _i(j['units']),
        revenue = _d(j['revenue']);
  final int id, units;
  final String name;
  final double revenue;
}

/// The "needs attention" counts (also `GET /dashboard/attention`).
class Attention {
  Attention(Map<String, dynamic> j)
      : ordersToConfirm = _i(j['ordersToConfirm']),
        ordersToPack = _i(j['ordersToPack']),
        ordersToShip = _i(j['ordersToShip']),
        ordersOnTheWay = _i(j['ordersOnTheWay']),
        returnRequests = _i(j['returnRequests']),
        returnsInProgress = _i(j['returnsInProgress']),
        offersWaiting = _i(j['offersWaiting']),
        outOfStockSkus = _i(j['outOfStockSkus']),
        lowStockSkus = _i(j['lowStockSkus']),
        lowStockAt = _i(j['lowStockAt']),
        productsPending = _i(j['productsPending']),
        reviewsUnanswered = _i(j['reviewsUnanswered']),
        questionsToAnswer = _i(j['questionsToAnswer']),
        paymentClaims = _i(j['paymentClaims']),
        refundsToSend = _i(j['refundsToSend']);

  final int ordersToConfirm, ordersToPack, ordersToShip, ordersOnTheWay, returnRequests, returnsInProgress;
  final int offersWaiting, outOfStockSkus, lowStockSkus, lowStockAt, productsPending, reviewsUnanswered;
  final int questionsToAnswer, paymentClaims, refundsToSend;
}

class WishlistTop {
  WishlistTop(Map<String, dynamic> j)
      : name = j['name'] as String? ?? '',
        saves = _i(j['wishlistCount']);
  final String name;
  final int saves;
}

class ProductCounts {
  ProductCounts(Map<String, dynamic> j)
      : total = _i(j['totalProducts']),
        visible = _i(j['visibleProducts']),
        locked = _i(j['lockedProducts']),
        totalSkus = _i(j['totalSkus']),
        outOfStockSkus = _i(j['outOfStockSkus']),
        approved = _i(_m(j['status'])['approved']),
        pending = _i(_m(j['status'])['pending']),
        rejected = _i(_m(j['status'])['rejected']),
        active = _i(_m(j['activeStatus'])['active']),
        inactive = _i(_m(j['activeStatus'])['inactive']),
        suspended = _i(_m(j['activeStatus'])['suspended']);
  final int total, visible, locked, totalSkus, outOfStockSkus, approved, pending, rejected, active, inactive, suspended;
}

class Dashboard {
  Dashboard(Map<String, dynamic> j)
      : totals = DashboardTotals(_m(j['totals'])),
        series = [for (final p in (j['series'] as List? ?? const [])) SeriesPoint(p as Map<String, dynamic>)],
        monthly = j['bucket'] == 'month',
        ordersByStatus = [for (final p in (j['ordersByStatus'] as List? ?? const [])) StatusCount(p as Map<String, dynamic>)],
        topProducts = [for (final p in (j['topProducts'] as List? ?? const [])) TopProduct(p as Map<String, dynamic>)],
        attention = Attention(_m(j['attention'])),
        products = ProductCounts(_m(j['products'])),
        balanceTotal = _d(_m(j['balance'])['total']),
        balanceDue = _d(_m(j['balance'])['due']),
        balancePaid = _d(_m(j['balance'])['paid']),
        reviewCount = _i(_m(j['reviews'])['count']),
        reviewAverage = (_m(j['reviews'])['average'] as num?)?.toDouble(),
        wishlistSaves = _i(_m(j['wishlist'])['totalSaves']),
        wishlistProducts = _i(_m(j['wishlist'])['productsSaved']),
        wishlistTop = [for (final p in (_m(j['wishlist'])['top'] as List? ?? const [])) WishlistTop(p as Map<String, dynamic>)];

  final DashboardTotals totals;
  final List<SeriesPoint> series;
  final bool monthly;
  final List<StatusCount> ordersByStatus;
  final List<TopProduct> topProducts;
  final Attention attention;
  final ProductCounts products;
  final double balanceTotal, balanceDue, balancePaid;
  final int reviewCount, wishlistSaves, wishlistProducts;
  final double? reviewAverage;
  final List<WishlistTop> wishlistTop;
}
