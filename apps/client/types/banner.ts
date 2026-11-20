export type BannerPosition = 'home_top' | 'home_middle' | 'home_bottom';

export const BANNER_POSITIONS: { value: BannerPosition; label: string }[] = [
  { value: 'home_top', label: 'Home top' },
  { value: 'home_middle', label: 'Home middle' },
  { value: 'home_bottom', label: 'Home bottom' },
];

export interface Banner {
  id: number;
  title: string;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  position: BannerPosition;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BannerListResponse {
  results: Banner[];
  nextCursor: number | null;
}

export type BannerSchedule = 'live' | 'scheduled' | 'expired';

export interface BannerListParams {
  search?: string;
  position?: BannerPosition;
  isActive?: boolean;
  schedule?: BannerSchedule;
  sort?: 'newest' | 'displayOrder';
  cursor?: number;
  limit?: number;
}
