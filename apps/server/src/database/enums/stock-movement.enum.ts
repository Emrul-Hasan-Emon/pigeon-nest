/** Why a SKU's stock changed. */
export enum StockReason {
  // The option was added with this much stock.
  INITIAL = 'initial',
  // A seller or admin typed a new quantity.
  EDITED = 'edited',
  // An order took stock.
  ORDER_PLACED = 'order_placed',
  // An order was cancelled and the stock went back.
  ORDER_CANCELLED = 'order_cancelled',
  // A cancelled order was reopened and took the stock again.
  ORDER_REOPENED = 'order_reopened',
}
