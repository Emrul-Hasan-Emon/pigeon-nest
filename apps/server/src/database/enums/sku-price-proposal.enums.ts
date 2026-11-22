// Where a buyer's price proposal stands.
// pending: still being negotiated. accepted: both sides agree on the price.
// rejected / cancelled: closed, the buyer may propose again.
// used: an order was placed at the agreed price.
export enum SkuPriceProposalStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  USED = 'used',
}

// Whose turn it is while a proposal is pending.
export enum ProposalParty {
  BUYER = 'buyer',
  SELLER = 'seller',
}

// One step in a proposal's history.
export enum SkuPriceProposalAction {
  CREATED = 'created',
  COUNTERED = 'countered',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  USED = 'used',
}
