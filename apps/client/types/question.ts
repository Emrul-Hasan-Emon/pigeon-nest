/** A question as a shopper sees it on a product page. */
export interface PublicQuestion {
  id: number;
  askerName: string;
  question: string;
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
}

/** A question as the shop and staff see it. */
export interface StaffQuestion {
  id: number;
  product: { id: number; name: string; slug: string };
  askerName: string;
  question: string;
  answer: string | null;
  answeredAt: string | null;
  status: 'published' | 'hidden';
  hiddenReason: string | null;
  createdAt: string;
  /** Admin lists only. */
  seller?: { id: number; name: string };
}

export interface QuestionPage<T> {
  results: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type AnsweredFilter = 'all' | 'unanswered' | 'answered';
