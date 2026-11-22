export enum ReturnScope {
  // Every item still not returned, and (when configured) the delivery charge.
  FULL_ORDER = 'full_order',
  // One or more chosen items. Never includes the delivery charge.
  ITEMS = 'items',
}
