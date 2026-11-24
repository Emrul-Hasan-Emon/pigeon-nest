import { Banknote, CircleHelp, Coins, CreditCard, FileText, HandCoins, Heart, House, Landmark, LineChart, MailCheck, MessageCircleQuestion, Package, ReceiptText, Rocket, RotateCcw, Star, UserRound, type LucideIcon } from 'lucide-react';

// Icons a Help topic can ask for by name ("icon" in its JSON file). To offer a new one, import it and add a line.
const ICONS: Record<string, LucideIcon> = {
  rocket: Rocket,
  house: House,
  'receipt-text': ReceiptText,
  package: Package,
  'credit-card': CreditCard,
  'mail-check': MailCheck,
  landmark: Landmark,
  'rotate-ccw': RotateCcw,
  banknote: Banknote,
  'hand-coins': HandCoins,
  'message-circle-question': MessageCircleQuestion,
  star: Star,
  heart: Heart,
  'line-chart': LineChart,
  'file-text': FileText,
  coins: Coins,
  'user-round': UserRound,
  'circle-help': CircleHelp,
};

export function helpIcon(name: string | undefined): LucideIcon {
  return (name && ICONS[name]) || CircleHelp;
}
