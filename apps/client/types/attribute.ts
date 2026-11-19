export interface AttributeValue {
  id: number;
  attributeId: number;
  name: string;
  description: string | null;
  colorCode: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Attribute {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  values: AttributeValue[];
  createdAt: string;
  updatedAt: string;
}

export interface AttributeListResponse {
  results: Attribute[];
  nextCursor: number | null;
}

export interface AttributeListParams {
  search?: string;
  isActive?: boolean;
  cursor?: number;
  limit?: number;
}
