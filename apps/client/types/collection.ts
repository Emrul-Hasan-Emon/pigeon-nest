export interface Collection {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  sortOrder: number;
  colorCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionListResponse {
  results: Collection[];
  nextCursor: number | null;
}

export interface CollectionListParams {
  search?: string;
  isActive?: boolean;
  cursor?: number;
  limit?: number;
}
