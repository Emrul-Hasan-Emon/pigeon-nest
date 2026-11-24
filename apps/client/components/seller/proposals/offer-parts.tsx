import { money } from '@/components/orders/ui';
import { formatDateTime } from '@/lib/datetime';
import type { Proposal, ProposalHistoryEntry } from '@/types/proposal';

/** Status pill; an open offer says whose turn it is. */
export function OfferStatusBadge({ proposal }: { proposal: Proposal }) {
  let label: string;
  let tone: string;
  switch (proposal.status) {
    case 'pending':
      label = proposal.awaitingParty === 'seller' ? 'Your turn' : 'Waiting for buyer';
      tone = proposal.awaitingParty === 'seller' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800';
      break;
    case 'accepted':
      label = 'Accepted';
      tone = 'bg-emerald-100 text-emerald-700';
      break;
    case 'used':
      label = 'Used';
      tone = 'bg-indigo-100 text-indigo-800';
      break;
    case 'rejected':
      label = 'Rejected';
      tone = 'bg-destructive/10 text-destructive';
      break;
    default:
      label = 'Cancelled';
      tone = 'bg-muted text-muted-foreground';
  }
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{label}</span>;
}

const taka = (n: number) => `৳${money(n)}`;

function who(e: ProposalHistoryEntry) {
  if (e.actorType === 'seller') return 'You';
  if (e.actorType === 'admin') return 'The admin team';
  return e.actorName ?? 'The buyer';
}

/** One step said as a full sentence, so nobody has to decode it. */
function step(e: ProposalHistoryEntry) {
  const deal = `${taka(e.price)} each for ${e.quantity} (${taka(e.price * e.quantity)} in all)`;
  switch (e.action) {
    case 'created':
      return { title: `${who(e)} made an offer`, detail: `Asked to pay ${deal}. Your price then was ${taka(e.skuPriceAtTime)} each.` };
    case 'countered':
      return { title: `${who(e)} suggested a new price`, detail: `Now asking ${deal}. The shop price then was ${taka(e.skuPriceAtTime)} each.` };
    case 'accepted':
      return { title: `${who(e)} said yes`, detail: `Agreed on ${deal}.` };
    case 'rejected':
      return { title: `${who(e)} said no`, detail: 'The offer was turned down.' };
    case 'cancelled':
      return { title: `${who(e)} cancelled the offer`, detail: 'Nothing more will happen on it.' };
    default:
      return { title: 'The buyer ordered at this price', detail: `Bought ${deal}.` };
  }
}

/** Every step of the negotiation, oldest first. */
export function OfferTimeline({ history }: { history: ProposalHistoryEntry[] }) {
  return (
    <ol className="space-y-4 border-l-2 border-border pl-5">
      {history.map((e) => {
        const t = step(e);
        return (
          <li key={e.id} className="relative">
            <span className="absolute -left-[1.6rem] top-1.5 h-3 w-3 rounded-full border-2 border-card bg-primary" />
            <p className="text-base font-semibold text-foreground">{t.title}</p>
            <p className="text-base text-foreground">{t.detail}</p>
            {e.note && (
              <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-base text-foreground">
                <span className="text-sm text-muted-foreground">Message: </span>“{e.note}”
              </p>
            )}
            <p className="text-sm text-muted-foreground">{formatDateTime(e.createdAt)}</p>
          </li>
        );
      })}
    </ol>
  );
}
