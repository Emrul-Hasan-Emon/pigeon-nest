import '../../../shared/format/text.dart';
double _d(Object? v) => (v as num?)?.toDouble() ?? 0;
int _i(Object? v) => (v as num?)?.toInt() ?? 0;
String? _s(Object? v) => (v is String && v.isNotEmpty) ? v : null;
Map<String, dynamic> _m(Object? v) => (v as Map<String, dynamic>?) ?? const {};
List<Map<String, dynamic>> _l(Object? v) => [for (final e in (v as List? ?? const [])) e as Map<String, dynamic>];
DateTime _t(Object? v) => DateTime.tryParse(v as String? ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0);

const orderStatuses = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
const paymentStatuses = ['due', 'partially_paid', 'paid'];


class Customer {
  Customer(Map<String, dynamic> j)
      : userId = j['userId'] as int?,
        isGuest = j['isGuest'] as bool? ?? false,
        name = _s(j['name']) ?? 'Customer',
        phone = _s(j['phone']),
        email = _s(j['email']);
  final int? userId;
  final bool isGuest;
  final String name;
  final String? phone, email;
}

class OrderRow {
  OrderRow(Map<String, dynamic> j)
      : id = _i(j['id']),
        orderNumber = j['orderNumber'] as String? ?? '',
        status = j['status'] as String? ?? '',
        paymentStatus = j['paymentStatus'] as String? ?? '',
        itemCount = _i(j['itemCount']),
        payable = _d(j['payable']),
        amountPaid = _d(j['amountPaid']),
        gatewayName = _s(_m(j['gateway'])['name']),
        customer = Customer(_m(j['customer'])),
        previewImage = _s(_l(j['previewItems']).isEmpty ? null : _l(j['previewItems']).first['imageUrl']),
        previewName = _s(_l(j['previewItems']).isEmpty ? null : _l(j['previewItems']).first['productName']),
        allowedStatuses = [for (final s in (j['allowedStatuses'] as List? ?? const [])) s as String],
        createdAt = _t(j['createdAt']);

  final int id, itemCount;
  final String orderNumber, status, paymentStatus;
  final double payable, amountPaid;
  final String? gatewayName, previewImage, previewName;
  final Customer customer;
  final List<String> allowedStatuses;
  final DateTime createdAt;
}

class Attachment {
  Attachment(Map<String, dynamic> j)
      : fileName = j['fileName'] as String? ?? 'file',
        url = j['url'] as String? ?? '',
        kind = j['kind'] as String? ?? 'file';
  final String fileName, url, kind;
  bool get isImage => kind == 'image';
}

class OrderItem {
  OrderItem(Map<String, dynamic> j)
      : productName = j['productName'] as String? ?? '',
        skuLabel = _s(_m(j['sku'])['label']),
        skuCode = _s(_m(j['sku'])['code']),
        imageUrl = _s(j['imageUrl']),
        quantity = _i(j['quantity']),
        unitPayable = _d(j['unitPayable']),
        lineTotal = _d(j['lineTotal']),
        sellerAmount = _d(j['sellerAmount']),
        systemCommission = _d(j['systemCommission']),
        isReturned = j['isReturned'] as bool? ?? false,
        birdLines = _birdLines(_m(j['bird']));
  final String productName;
  final String? skuLabel, skuCode, imageUrl;
  final int quantity;
  final double unitPayable, lineTotal, sellerAmount, systemCommission;
  final bool isReturned;
  final List<String> birdLines;

  static List<String> _birdLines(Map<String, dynamic> b) {
    if (b.isEmpty) return const [];
    String? parent(Object? p) {
      final m = _m(p);
      final n = _s(m['name']);
      if (n == null) return null;
      final ring = _s(m['ringNumber']);
      return ring == null ? n : '$n ($ring)';
    }

    final out = <String>[];
    void add(String label, String? v) {
      if (v != null) out.add('$label: $v');
    }

    add('Ring', _s(b['ringNumber']));
    add('Hatched', _s(b['hatchDate']));
    add('Breed', _s(b['breed']));
    add('Bloodline', _s(b['bloodline']));
    final vaccine = _s(b['vaccineName']);
    add('Vaccine', vaccine == null ? null : (_s(b['vaccinatedOn']) == null ? vaccine : '$vaccine, ${b['vaccinatedOn']}'));
    add('Sire', parent(b['sire']));
    add('Dam', parent(b['dam']));
    return out;
  }
}

class OrderPayment {
  OrderPayment(Map<String, dynamic> j)
      : id = _i(j['id']),
        status = j['status'] as String? ?? '',
        amount = _d(j['amount']),
        transactionId = _s(j['transactionId']),
        description = _s(j['description']),
        paidAt = j['paidAt'] == null ? null : _t(j['paidAt']),
        recordedBy = _s(_m(j['recordedBy'])['name']),
        recordedByType = _s(_m(j['recordedBy'])['type']),
        reversed = j['reversal'] != null,
        reversalReason = _s(_m(j['reversal'])['reason']),
        attachments = [for (final a in _l(j['attachments'])) Attachment(a)];
  final int id;
  final String status;
  final double amount;
  final String? transactionId, description, recordedBy, recordedByType, reversalReason;
  final DateTime? paidAt;
  final bool reversed;
  final List<Attachment> attachments;

  /// A receipt's status is the order's payment state when the money came in. `due` means nothing was received.
  bool get received => status == 'partially_paid' || status == 'paid';

  /// A seller may only reverse a receipt a seller recorded, that was received and is not reversed yet.
  bool get canReverse => !reversed && received && recordedByType == 'seller';
}

class HistoryLine {
  HistoryLine(this.title, this.note, this.by, this.at);
  final String title;
  final String? note, by;
  final DateTime at;
}

class OrderUpdate {
  OrderUpdate(Map<String, dynamic> j)
      : message = _s(j['message']),
        by = _s(_m(j['by'])['name']),
        at = _t(j['createdAt']),
        attachments = [for (final a in _l(j['attachments'])) Attachment(a)];
  final String? message, by;
  final DateTime at;
  final List<Attachment> attachments;
}

class PayTo {
  PayTo(Map<String, dynamic> j)
      : provider = _s(j['provider']) ?? '',
        accountName = _s(j['accountName']),
        accountNumber = _s(j['accountNumber']);
  final String provider;
  final String? accountName, accountNumber;
}

class OrderDetail {
  OrderDetail(Map<String, dynamic> j)
      : row = OrderRow(j),
        items = [for (final i in _l(j['items'])) OrderItem(i)],
        subtotal = _d(_m(j['totals'])['subtotal']),
        deliveryCharge = _d(_m(j['totals'])['deliveryCharge']),
        discountAmount = _d(_m(j['totals'])['discountAmount']),
        balanceDue = _d(_m(j['totals'])['balanceDue']),
        systemCommission = _d(_m(j['commission'])['systemCommission']),
        sellerAmount = _d(_m(j['commission'])['sellerAmount']),
        deliveryType = _s(_m(j['delivery'])['type']),
        estimatedDays = _m(j['delivery'])['estimatedDays'] as int?,
        recipient = _s(_m(j['address'])['recipientName']),
        recipientPhone = _s(_m(j['address'])['phone']),
        addressLines = _addressLines(_m(j['address'])),
        payments = [for (final p in _l(j['payments'])) OrderPayment(p)],
        updates = [for (final u in _l(j['updates'])) OrderUpdate(u)],
        history = [
          for (final h in _l(j['statusHistory']))
            HistoryLine(statusLabel(h['status'] as String? ?? ''), _s(h['note']), _s(_m(h['by'])['name']), _t(h['createdAt'])),
        ],
        payTo = [for (final p in _l(j['payTo'])) PayTo(p)],
        customerNote = _s(j['note']);

  final OrderRow row;
  final List<OrderItem> items;
  final double subtotal, deliveryCharge, discountAmount, balanceDue, systemCommission, sellerAmount;
  final String? deliveryType, recipient, recipientPhone, customerNote;
  final int? estimatedDays;
  final List<String> addressLines;
  final List<OrderPayment> payments;
  final List<OrderUpdate> updates;
  final List<HistoryLine> history;
  final List<PayTo> payTo;

  bool get canRecordPayment => row.status != 'cancelled' && balanceDue > 0;

  static List<String> _addressLines(Map<String, dynamic> a) {
    final street = _s(a['line']);
    final place = [_s(a['city']), _s(a['state']), _s(a['postalCode'])].whereType<String>().join(', ');
    return [?street, if (place.isNotEmpty) place, ?_s(a['countryName'])];
  }
}

// ---- entering an order ----

class CatalogSku {
  CatalogSku(Map<String, dynamic> j, this.productId, this.productName)
      : id = _i(j['id']),
        label = _s(j['label']) ?? _s(j['code']) ?? 'Default',
        payable = _d(j['payable']),
        stock = _i(j['quantity']);
  final int id, productId, stock;
  final String productName, label;
  final double payable;
}

class DeliveryOption {
  DeliveryOption(Map<String, dynamic> j)
      : type = j['deliveryType'] as String? ?? '',
        charge = _d(j['charge']),
        estimatedDays = j['estimatedDays'] as int?,
        payable = _d(j['payable']);
  final String type;
  final double charge, payable;
  final int? estimatedDays;
}

class Gateway {
  Gateway(Map<String, dynamic> j)
      : id = _i(j['id']),
        name = j['name'] as String? ?? '',
        typeLabel = _s(j['typeLabel']);
  final int id;
  final String name;
  final String? typeLabel;
}

class OrderOptions {
  OrderOptions(Map<String, dynamic> j)
      : countries = [for (final c in _l(j['countries'])) (c['code'] as String, c['name'] as String)],
        delivery = [for (final d in _l(j['deliveryOptions'])) DeliveryOption(d)],
        gateways = [for (final g in _l(j['paymentGateways'])) Gateway(g)];
  final List<(String, String)> countries;
  final List<DeliveryOption> delivery;
  final List<Gateway> gateways;
}

class FoundCustomer {
  FoundCustomer(Map<String, dynamic> j)
      : id = _i(j['id']),
        name = j['name'] as String? ?? '',
        contact = _s(j['phone']) ?? _s(j['email']) ?? '',
        canOrder = j['canOrder'] as bool? ?? true;
  final int id;
  final String name, contact;
  final bool canOrder;
}

class SavedAddress {
  SavedAddress(Map<String, dynamic> j)
      : recipientName = _s(j['recipientName']) ?? '',
        phone = _s(j['phone']) ?? '',
        countryCode = _s(j['countryCode']) ?? '',
        city = _s(j['city']) ?? '',
        state = _s(j['state']),
        postalCode = _s(j['zipCode']),
        line = _s(j['address']) ?? '';
  final String recipientName, phone, countryCode, city, line;
  final String? state, postalCode;
}
