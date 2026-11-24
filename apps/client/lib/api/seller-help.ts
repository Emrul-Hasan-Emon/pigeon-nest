import { sellerHttp } from './http';
import type { HelpTopic, HelpTopicSummary } from '@/lib/seller-help/types';

export const listHelpTopics = () => sellerHttp.get<{ topics: HelpTopicSummary[] }>('/help').then((r) => r.topics);
export const getHelpTopic = (slug: string) => sellerHttp.get<HelpTopic>(`/help/${encodeURIComponent(slug)}`);
