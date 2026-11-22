import { money } from '@/components/orders/ui';
import { formatDateTime } from '@/lib/datetime';
import type { Proposal, ProposalHistoryAction, ProposalHistoryEntry } from '@/types/proposal';

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

const VERB: Record<ProposalHistoryAction, string> = {
  created: 'offered',
  countered: 'countered with',
  accepted: 'accepted',
  rejected: 'rejected',
  cancelled: 'cancelled',
  used: 'bought at',
};

function who(e: ProposalHistoryEntry) {
  if (e.actorType === 'seller') return 'You';
  if (e.actorType === 'admin') return 'Admin';
  return e.actorName ?? 'Buyer';
}

/** Every step of the negotiation, oldest first. */
export function OfferTimeline({ history }: { history: ProposalHistoryEntry[] }) {
  return (
    <ol className="space-y-3 border-l border-border pl-4">
      {history.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
          <p className="text-sm text-foreground">
            <strong className="font-medium">{who(e)}</strong> {VERB[e.action]}{' '}
            {e.action !== 'cancelled' && e.action !== 'rejected' && <strong className="font-medium">{money(e.price)} × {e.quantity}</strong>}
            {e.action === 'countered' || e.action === 'created' ? <span className="text-muted-foreground"> (SKU price then {money(e.skuPriceAtTime)})</span> : null}
          </p>
          {e.note && <p className="mt-0.5 whitespace-pre-wrap rounded-md bg-muted px-2 py-1 text-sm text-foreground">“{e.note}”</p>}
          <p className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</p>
        </li>
      ))}
    </ol>
  );
}
