// What every figure on the two dashboards means, in plain words. Kept next to the dashboards: when a figure
// changes there, change it here too. The definitions match docs/dashboard-guide.md on the server.

export interface GuideItem {
  name: string;
  means: string;
  how?: string;
  tip?: string;
}

export interface GuideSection {
  title: string;
  intro?: string;
  items: GuideItem[];
}

const PERIOD: GuideSection = {
  title: 'Reading the page',
  intro: 'Most figures cover a period you choose at the top right. Figures about work waiting for you are live and ignore the period.',
  items: [
    {
      name: 'Period (7 days, 30 days, 90 days, 12 months)',
      means: 'How far back the figures look. 30 days is the default. The 12 months view groups the chart by month instead of by day.',
    },
    {
      name: '▲ 12% vs the period before',
      means: 'How much the figure moved compared with the period of the same length just before it. If you picked 30 days, it compares with the 30 days before those.',
      how: '(this period - the period before) / the period before. Green is good news, red is bad news.',
      tip: '"No earlier figure to compare" means the period before had nothing, so a percentage would be meaningless.',
    },
    {
      name: 'What counts as a sale',
      means: 'An order that is fully paid and not cancelled. It is counted on the day it was placed, not the day the money arrived or the day it was delivered.',
      tip: 'An order that is still waiting for payment is not a sale yet. It appears in "Orders placed" and "Orders by status".',
    },
  ],
};

const STATUSES: GuideSection = {
  title: 'Orders by status',
  intro: 'Orders placed in the period, grouped by where they are now. Every status is listed, even at zero.',
  items: [
    { name: 'Pending', means: 'Placed, and not yet confirmed by the seller.' },
    { name: 'Confirmed', means: 'The seller accepted the order and will prepare it.' },
    { name: 'Packed', means: 'The birds are packed and waiting for dispatch.' },
    { name: 'Shipped', means: 'On the way to the customer.' },
    { name: 'Delivered', means: 'Received by the customer. Only delivered, fully paid orders can be returned.' },
    { name: 'Cancelled', means: 'Stopped before delivery. Cancelled orders never count as sales.' },
  ],
};

export const ADMIN_GUIDE: GuideSection[] = [
  PERIOD,
  {
    title: 'The lead card and the figures',
    intro: 'The dark card at the top left is net sales, with the sales, refunds and commission it is made of listed under it. The cards below group the other figures: Orders, Commission and Marketplace.',
    items: [
      {
        name: 'Sales',
        means: 'The total value customers paid for orders in the period, including the delivery charge.',
        how: 'Sum of the payable amount of fully paid, not cancelled orders placed in the period.',
        tip: 'Example: an order of 3,200 for the birds plus 100 delivery adds 3,300.',
      },
      {
        name: 'Net sales',
        means: 'Sales after taking away the money given back to customers in the period.',
        how: 'Sales - refunds.',
      },
      { name: 'Orders placed', means: 'Every order created in the period, paid or not, cancelled or not.' },
      {
        name: 'Average order',
        means: 'What a typical paid order is worth.',
        how: 'Sales / number of paid orders.',
      },
      {
        name: 'Refunds',
        means: 'Money returned to customers for returns that were confirmed as "returned" in the period. The small line under it counts those returns.',
        how: 'Sum of the refund amount of returns confirmed in the period. A return counts on the day it was confirmed, which can be later than the sale.',
        tip: 'A return still being processed is not a refund yet.',
      },
      {
        name: 'Return rate',
        means: 'How many sales ended up with a return against them.',
        how: 'Paid orders in the period that have a return which is not cancelled or rejected, divided by paid orders in the period.',
        tip: 'A rising rate usually points to a quality or description problem with some seller or product.',
      },
      {
        name: 'Commission earned (lead card) and Earned this period',
        means: "The marketplace's cut from the period's sales, after taking back the commission on returned items.",
        how: 'Commission on paid orders placed in the period - commission taken back by returns confirmed in the period. Each item has its own commission, worked out when the order was placed.',
      },
      {
        name: 'Owed by sellers',
        means: 'What sellers still have to pay the marketplace right now, added up over all sellers. The line under it says how many sellers owe something.',
        how: "The sum of every seller's due commission balance. It is a live balance, not a period figure.",
        tip: 'A seller who paid commission and then had an order returned can show a negative balance. That is a credit to them.',
      },
    ],
  },
  {
    title: 'Charts and lists',
    items: [
      {
        name: 'Sales over time',
        means: 'One bar per day (per month in the 12 months view). The brass bar is sales. The thin red bar beside it is refunds confirmed that day.',
        tip: 'Move over the chart and the line above it shows the exact sales, refunds and orders of that day. The figures on the left are the grid lines. The dates under the chart are the first and last day of the period, with some in between.',
      },
      {
        name: 'Top sellers',
        means: 'The five sellers with the most sales in the period, with their paid orders and the commission on them.',
        how: 'Sales of fully paid, not cancelled orders, grouped by seller. Click a name to open the seller.',
      },
      {
        name: 'Top products',
        means: 'The five products that earned the most in the period, with units sold.',
        how: 'Order lines of paid, not cancelled orders, grouped by product. A returned line is left out.',
      },
    ],
  },
  {
    title: 'Needs attention',
    intro: 'Work waiting for an admin right now. A line only shows when its count is above zero. Click a line to go to it.',
    items: [
      { name: 'Sellers waiting for approval', means: 'New sellers who registered and have not been approved or rejected yet. They cannot sell until you decide.' },
      { name: 'Products waiting for review', means: 'Products sellers submitted that are not approved yet. They stay off the storefront until you approve them.' },
      { name: 'Return requests', means: 'Returns a customer or admin opened that the seller has not accepted or rejected yet.' },
      { name: 'Returns in progress', means: 'Returns the seller accepted that are on the way to a refund: accepted, processing or returning money. An admin gives the final "returned".' },
      { name: 'Delivered, not fully paid', means: 'Orders already delivered whose payment is not complete. These need chasing, so they are shown in red.' },
      { name: 'Reported reviews', means: 'Customer reviews that someone reported and nobody has decided on yet.' },
    ],
  },
  STATUSES,
  {
    title: 'Marketplace and commission balances',
    items: [
      { name: 'Customers', means: 'All customer accounts. The line under it says how many joined in the period.' },
      { name: 'Sellers', means: 'All seller accounts. The line says how many are new in the period and how many are approved and active.' },
      { name: 'Live products', means: 'Products customers can see and buy now: approved by an admin and switched on by the seller.' },
      { name: 'Paid in so far', means: 'Commission sellers have already paid to the marketplace, in total. The line under it shows all the commission earned to date.' },
    ],
  },
];

export const SELLER_GUIDE: GuideSection[] = [
  PERIOD,
  {
    title: 'Your sales',
    intro: 'The dark card at the top left is what you keep, with your sales, the commission and the refunds under it. The cards below group the other figures: Orders and Commission.',
    items: [
      {
        name: 'Sales',
        means: 'The total value of your paid orders in the period, including the delivery charge.',
        how: 'Sum of the payable amount of your fully paid, not cancelled orders placed in the period.',
        tip: 'Example: an order of 3,200 for the birds plus 100 delivery adds 3,300.',
      },
      {
        name: 'You keep',
        means: 'What is left for you after the marketplace takes its commission and after refunds.',
        how: "Your share of the paid orders (sales minus commission) - the money refunded for confirmed returns, plus the commission taken back on them.",
        tip: 'When an item is returned, the marketplace gives its commission on that item back, so you lose the refund minus that commission.',
      },
      { name: 'Orders placed', means: 'Every order for your birds created in the period, whether it was paid or cancelled.' },
      { name: 'Average order', means: 'What a typical paid order is worth.', how: 'Sales / number of paid orders.' },
      {
        name: 'Refunds',
        means: 'Money returned to customers for your returns that were confirmed as "returned" in the period.',
        how: 'Counted on the day the return was confirmed, which can be later than the sale. A return still being processed is not a refund yet.',
      },
      {
        name: 'Return rate',
        means: 'How many of your sales ended up with a return against them.',
        how: 'Paid orders in the period that have a return which is not cancelled or rejected, divided by paid orders in the period.',
      },
      {
        name: "Commission (lead card) and On this period's sales",
        means: "The marketplace's cut from this period's sales, after the commission given back on returns.",
        how: 'Each item carries its own commission, worked out when the order was placed from your own rate or the marketplace rate.',
      },
      {
        name: 'You owe',
        means: 'What you still have to pay the marketplace right now. The line under it shows what you have paid so far.',
        how: 'Your live commission balance, not a period figure. Details and payments are under Commission.',
        tip: 'If a returned order was already paid for, your balance can go below zero. That is a credit and it cancels against the commission on your next orders.',
      },
    ],
  },
  {
    title: 'Charts and lists',
    items: [
      {
        name: 'Sales over time',
        means: 'One bar per day (per month in the 12 months view). The brass bar is your sales. The thin red bar beside it is refunds confirmed that day.',
        tip: 'Move over the chart and the line above it shows the exact figures of that day.',
      },
      {
        name: 'Top products',
        means: 'Your five best products in the period, with units sold.',
        how: 'Order lines of paid, not cancelled orders, grouped by product. A returned line is left out. Click a name to open the product.',
      },
      {
        name: 'Reviews',
        means: 'The average star rating and the number of published reviews across all your products.',
        tip: 'Hidden reviews are not counted.',
      },
    ],
  },
  {
    title: 'To do',
    intro: 'Work waiting for you right now. A line only shows when its count is above zero. Click a line to go to it.',
    items: [
      { name: 'Orders to confirm', means: 'New orders you have not confirmed yet. Confirm them so the customer knows you are on it.' },
      { name: 'Orders to pack', means: 'Confirmed orders waiting to be packed.' },
      { name: 'Orders to ship', means: 'Packed orders waiting to be handed over for delivery.' },
      { name: 'Return requests', means: 'Customers asking to return an order or items. Accept or reject each one (a reason is required to reject). Shown in red because customers are waiting.' },
      { name: 'Returns in progress', means: 'Returns you accepted. Move them along: processing, then returning money with a note and proof. An admin confirms the final step.' },
      { name: 'Price offers to answer', means: 'Buyers who proposed a price on one of your birds and are waiting for your answer.' },
      { name: 'SKUs out of stock', means: 'Variants of your products with none left. Customers cannot buy them until you add stock. Shown in red.' },
      { name: 'SKUs with 5 or fewer left', means: 'Variants that are nearly sold out, so you can restock before they run out.' },
      { name: 'Reviews without a reply', means: 'Published reviews you have not answered. Replies are public.' },
      { name: 'Products waiting for approval', means: 'Products you submitted that an admin has not approved yet. They are not on the storefront until then.' },
    ],
  },
  STATUSES,
  {
    title: 'Your products',
    intro: 'The lower half of the dashboard counts your catalogue.',
    items: [
      { name: 'Total products (Catalogue)', means: 'All your products, except deleted ones.' },
      { name: 'Visible on storefront', means: 'Products customers can find and buy: approved by an admin and set to active by you.' },
      { name: 'Locked by admin', means: 'Products an admin rejected or suspended. You cannot change them until the admin does.' },
      { name: 'Total SKUs', means: 'Every variant you sell (for example each colour, age or size) across all products. The line under it says how many are out of stock.' },
      { name: 'Review status: Approved, Pending, Rejected', means: 'An admin reviews each product. Approved can be sold. Pending is waiting for review. Rejected was refused.' },
      { name: 'Activity: Active, Inactive, Suspended', means: 'Active is on sale. Inactive is switched off by you. Suspended is switched off by an admin.' },
      { name: 'Wishlist demand', means: 'How many times customers saved your products to a wishlist, and which products are saved most. Saves are interest, not orders, so it shows what to restock or promote.' },
    ],
  },
];
