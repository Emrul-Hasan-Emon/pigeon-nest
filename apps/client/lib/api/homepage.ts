import { http } from './http';
import { ENDPOINTS } from '../endpoints';
import type {
  HomepageListParams,
  HomepageListResponse,
  HomepagePreview,
  HomepageSection,
  HomepageSectionDetail,
  HomepageWritePayload,
  SectionTypeDefinition,
} from '@/types/homepage';

const E = ENDPOINTS.admin;

export function listSectionTypes() {
  return http.get<SectionTypeDefinition[]>(E.homepageSections.sectionTypes);
}

export function listHomepageSections(params: HomepageListParams) {
  return http.get<HomepageListResponse>(E.homepageSections.list, { ...params });
}
export function getHomepageSection(id: number) {
  return http.get<HomepageSectionDetail>(E.homepageSections.detail(id));
}
export function createHomepageSection(payload: HomepageWritePayload) {
  return http.post<HomepageSectionDetail>(E.homepageSections.list, payload);
}
export function updateHomepageSection(id: number, payload: HomepageWritePayload) {
  return http.patch<HomepageSectionDetail>(E.homepageSections.detail(id), payload);
}
export function deleteHomepageSection(id: number) {
  return http.delete<void>(E.homepageSections.detail(id));
}
export function reorderHomepageSections(ids: number[]) {
  return http.put<{ ids: number[] }>(E.homepageSections.reorder, { ids });
}
export function previewHomepageSection(id: number, device: 'mobile' | 'web') {
  return http.get<HomepagePreview>(E.homepageSections.preview(id), { device });
}

export function listHomepageSlots(params: HomepageListParams) {
  return http.get<HomepageListResponse>(E.homepageSlots.list, { ...params });
}
export function getHomepageSlot(id: number) {
  return http.get<HomepageSectionDetail>(E.homepageSlots.detail(id));
}
export function updateHomepageSlot(id: number, payload: HomepageWritePayload) {
  return http.patch<HomepageSectionDetail>(E.homepageSlots.detail(id), payload);
}
export function previewHomepageSlot(id: number, device: 'mobile' | 'web') {
  return http.get<HomepagePreview>(E.homepageSlots.preview(id), { device });
}

export type { HomepageSection };
