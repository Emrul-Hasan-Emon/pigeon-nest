import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PageRequest, pageResult } from '../../shared/utils/page-paginate.util';

export interface CategoryNode {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  children: CategoryNode[];
}

export interface Crumb {
  id: number;
  name: string;
  slug: string;
}

@Injectable()
export class StorefrontCatalogService {
  constructor(private readonly db: DatabaseService) {}

  /** Active categories as a nested tree (a category under an inactive parent is hidden). */
  async categoryTree(): Promise<CategoryNode[]> {
    const rows = await this.db.category
      .createQueryBuilder('c')
      .where('c.isActive = true')
      .orderBy('c.sortOrder', 'ASC')
      .addOrderBy('c.id', 'ASC')
      .getMany();
    const nodes = new Map<number, CategoryNode>(
      rows.map((c) => [
        c.id,
        { id: c.id, name: c.name, slug: c.slug, imageUrl: c.imageUrl ?? null, children: [] },
      ]),
    );
    const roots: CategoryNode[] = [];
    for (const c of rows) {
      const node = nodes.get(c.id)!;
      const parent = c.parentId ? nodes.get(c.parentId) : undefined;
      if (parent) parent.children.push(node);
      else if (!c.parentId) roots.push(node);
    }
    return roots;
  }

  async categoryBySlug(slug: string) {
    const all = await this.db.category.find();
    const byId = new Map(all.map((c) => [c.id, c]));
    const category = all.find((c) => c.slug === slug);
    if (!category || !category.isActive) {
      throw new NotFoundException('Category not found');
    }

    const breadcrumb: Crumb[] = [];
    for (let cur = category.parentId ? byId.get(category.parentId) : undefined; cur; ) {
      breadcrumb.unshift({ id: cur.id, name: cur.name, slug: cur.slug });
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    const children = all
      .filter((c) => c.parentId === category.id && c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map((c) => ({ id: c.id, name: c.name, slug: c.slug, imageUrl: c.imageUrl ?? null }));

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description ?? null,
      imageUrl: category.imageUrl ?? null,
      breadcrumb,
      children,
    };
  }

  async collections(page: PageRequest) {
    const [rows, total] = await this.db.collection
      .createQueryBuilder('c')
      .where('c.isActive = true')
      .orderBy('c.sortOrder', 'ASC')
      .addOrderBy('c.id', 'ASC')
      .skip(page.offset)
      .take(page.pageSize)
      .getManyAndCount();
    return pageResult(
      rows.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description ?? null,
        imageUrl: c.imageUrl ?? null,
        colorCode: c.colorCode ?? null,
      })),
      total,
      page,
    );
  }

  async collectionBySlug(slug: string) {
    const c = await this.db.collection.findOne({ where: { slug } });
    if (!c || !c.isActive) throw new NotFoundException('Collection not found');
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description ?? null,
      imageUrl: c.imageUrl ?? null,
      colorCode: c.colorCode ?? null,
    };
  }
}
