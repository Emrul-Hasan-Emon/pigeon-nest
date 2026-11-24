/**
 * The seller's Help, as the server sends it (GET /seller/help and /seller/help/:slug). The text itself lives in
 * apps/server/content/seller-help/*.json; see the README there to add or change a topic.
 */
export type HelpBlock =
  | { type: 'steps'; title?: string; steps: (string | { text: string; detail?: string })[] }
  | { type: 'words'; title?: string; items: { term: string; means: string }[] }
  | { type: 'points'; title?: string; items: string[] }
  | { type: 'faq'; title?: string; items: { q: string; a: string }[] }
  | { type: 'note'; tone?: 'info' | 'warn'; text: string };

export interface HelpSection {
  id: string;
  title: string;
  intro?: string;
  blocks: HelpBlock[];
}

/** One line of the Help menu. */
export interface HelpTopicSummary {
  slug: string;
  title: string;
  /** lucide icon name in kebab case; the portal shows a help icon when it does not know it. */
  icon: string;
  order: number;
  summary: string;
  openPath: string;
  openLabel: string;
}

export interface HelpTopic extends HelpTopicSummary {
  sections: HelpSection[];
}
