export type HomepageLayout = 'carousel' | 'grid' | 'list';
export type HomepageDevice = 'mobile' | 'web' | 'both';
export type HomepageSchedule = 'live' | 'scheduled' | 'expired';

export type ConfigFieldKind = 'int' | 'intArray' | 'enum' | 'boolean';
export type ConfigEntityKind = 'category' | 'collection' | 'product' | 'seller' | 'banner';

export interface ConfigField {
  key: string;
  label: string;
  kind: ConfigFieldKind;
  entity?: ConfigEntityKind;
  required?: boolean;
  min?: number;
  max?: number;
  maxItems?: number;
  enumValues?: string[];
  default?: number | boolean | string;
  help?: string;
}

export interface SectionTypeDefinition {
  type: string;
  label: string;
  defaultTitle: string;
  description: string;
  fields: ConfigField[];
  exactlyOne?: string[];
}

export interface HomepageSection {
  id: number;
  page: 'main' | 'slots';
  slotNo: number | null;
  title: string;
  sectionType: string;
  config: Record<string, unknown>;
  layout: HomepageLayout;
  deviceVisibility: HomepageDevice;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LookupEntity {
  id: number;
  name: string;
  imageUrl: string | null;
  eligible: boolean;
}

export interface HomepageSectionDetail extends HomepageSection {
  entities: Record<string, LookupEntity[]>;
  warnings: { field: string; entityId: number; message: string }[];
}

export interface HomepageListResponse {
  results: HomepageSection[];
  nextCursor: number | null;
}

export interface HomepageListParams {
  search?: string;
  sectionType?: string;
  isActive?: boolean;
  deviceVisibility?: HomepageDevice;
  schedule?: HomepageSchedule;
  sort?: 'newest' | 'displayOrder';
  cursor?: number;
  limit?: number;
}

export interface HomepageWritePayload {
  sectionType?: string;
  title?: string;
  layout?: HomepageLayout;
  deviceVisibility?: HomepageDevice;
  sortOrder?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
  config?: Record<string, unknown>;
}

export interface HomepagePreview {
  id: number;
  title: string;
  sectionType: string;
  layout: string;
  slotNo: number | null;
  device: 'mobile' | 'web';
  visible: boolean;
  items: Record<string, unknown>[];
}
