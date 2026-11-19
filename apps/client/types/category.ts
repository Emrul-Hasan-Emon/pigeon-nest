export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parentId: number | null;
  imagePath: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

export interface CategoryWithParents extends Category {
  parents: Category[];
}

export interface CategoryListResponse {
  results: Category[];
  nextCursor: number | null;
}

export interface CategoryListParams {
  search?: string;
  isActive?: boolean;
  cursor?: number;
  limit?: number;
}

export interface CategoryFormValues {
  name: string;
  description: string;
  parentId: number | null;
  sortOrder: number;
  isActive: boolean;
  image: File | null;
}
