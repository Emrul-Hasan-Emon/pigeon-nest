import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ILike, Not } from 'typeorm';
import { DatabaseService } from '../../../database/database.service';
import { FileUploadService } from '../../../file-management/file-upload.service';
import { Category } from '../../../database/entities/category/category.entity';
import { CreateCategoryDto } from '../dtos/create-category.dto';
import { UpdateCategoryDto } from '../dtos/update-category.dto';
import { ListCategoryQueryDto } from '../dtos/list-category-query.dto';
import { CategoryTreeQueryDto } from '../dtos/category-tree-query.dto';
import { slugify } from '../../../shared/utils/slugify.util';
import { CursorPagination } from '../../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../../shared/utils/cursor-paginate.util';

const IMAGE_FOLDER = 'categories';

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

@Injectable()
export class AdminCategoryService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  async list(query: ListCategoryQueryDto, pagination: CursorPagination) {
    const qb = this.databaseService.category
      .createQueryBuilder('category')
      .orderBy('category.id', 'DESC')
      .take(pagination.limit);

    if (query.search) {
      qb.andWhere('category.name ILIKE :search', { search: `%${query.search}%` });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('category.isActive = :isActive', { isActive: query.isActive });
    }
    if (pagination.cursor > 0) {
      qb.andWhere('category.id < :cursor', { cursor: pagination.cursor });
    }

    const results = await qb.getMany();
    return getCursorPaginateData(results, pagination.limit);
  }

  async create(dto: CreateCategoryDto, image?: Express.Multer.File) {
    await this.assertNameIsUnique(dto.name);

    if (dto.parentId !== undefined) {
      await this.findParentOrThrow(dto.parentId);
    }

    const category = this.databaseService.category.create({
      name: dto.name,
      slug: slugify(dto.name),
      description: dto.description,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      parentId: dto.parentId ?? null,
    });

    if (image) {
      const fileInfo = await this.fileUploadService.uploadFile(
        image,
        IMAGE_FOLDER,
      );
      category.imagePath = fileInfo.filePath;
      category.imageUrl = fileInfo.fileUrl;
    }

    return this.databaseService.category.save(category);
  }

  async update(
    id: number,
    dto: UpdateCategoryDto,
    image?: Express.Multer.File,
  ) {
    const category = await this.findOrThrow(id);

    if (dto.name !== undefined && dto.name !== category.name) {
      await this.assertNameIsUnique(dto.name, id);
      category.name = dto.name;
      category.slug = slugify(dto.name);
    }

    if (dto.parentId !== undefined) {
      if (dto.parentId === null) {
        category.parentId = null;
      } else {
        await this.findParentOrThrow(dto.parentId, id);
        category.parentId = dto.parentId;
      }
    }

    if (dto.description !== undefined) {
      category.description = dto.description;
    }
    if (dto.sortOrder !== undefined) {
      category.sortOrder = dto.sortOrder;
    }
    if (dto.isActive !== undefined) {
      category.isActive = dto.isActive;
    }

    if (image) {
      if (category.imagePath) {
        await this.fileUploadService.removeFile(category.imagePath);
      }
      const fileInfo = await this.fileUploadService.uploadFile(
        image,
        IMAGE_FOLDER,
      );
      category.imagePath = fileInfo.filePath;
      category.imageUrl = fileInfo.fileUrl;
    }

    return this.databaseService.category.save(category);
  }

  async remove(id: number) {
    const category = await this.findOrThrow(id);

    const childCount = await this.databaseService.category.count({
      where: { parentId: id },
    });
    if (childCount > 0) {
      throw new ConflictException(
        'Category has sub-categories and cannot be deleted',
      );
    }

    const productCount = await this.databaseService.sellerProduct.count({
      where: { categoryId: id },
    });
    if (productCount > 0) {
      throw new ConflictException(
        'Category is still referenced by products and cannot be deleted',
      );
    }

    await this.databaseService.category.delete(id);

    if (category.imagePath) {
      await this.fileUploadService.removeFile(category.imagePath);
    }
  }

  async parentChain(rawCategoryIds: string) {
    const ids = Array.from(
      new Set(
        rawCategoryIds
          .split(',')
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isInteger(value)),
      ),
    );

    const all = await this.databaseService.category.find();
    const byId = new Map(all.map((category) => [category.id, category]));

    return ids
      .filter((id) => byId.has(id))
      .map((id) => {
        const category = byId.get(id) as Category;
        const parents: Category[] = [];
        let cursor = category.parentId;
        while (cursor !== null && cursor !== undefined) {
          const parent = byId.get(cursor);
          if (!parent) {
            break;
          }
          parents.unshift(parent);
          cursor = parent.parentId;
        }
        return { ...category, parents };
      });
  }

  async tree(query: CategoryTreeQueryDto) {
    const all = await this.databaseService.category.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    const byId = new Map<number, CategoryTreeNode>(
      all.map((category) => [category.id, { ...category, children: [] }]),
    );
    const childrenOf = new Map<number, CategoryTreeNode[]>();
    const roots: CategoryTreeNode[] = [];

    for (const node of byId.values()) {
      if (node.parentId !== null && byId.has(node.parentId)) {
        const siblings = childrenOf.get(node.parentId) ?? [];
        siblings.push(node);
        childrenOf.set(node.parentId, siblings);
      } else {
        roots.push(node);
      }
    }
    for (const node of byId.values()) {
      node.children = childrenOf.get(node.id) ?? [];
    }

    if (!query.categoryName) {
      return roots;
    }

    const needle = query.categoryName.toLowerCase();
    const keep = new Set<number>();

    const keepDescendants = (node: CategoryTreeNode) => {
      keep.add(node.id);
      for (const child of node.children) {
        keepDescendants(child);
      }
    };
    const keepAncestors = (node: CategoryTreeNode) => {
      let cursor: number | null = node.parentId;
      while (cursor !== null) {
        keep.add(cursor);
        const parent = byId.get(cursor);
        if (!parent) {
          break;
        }
        cursor = parent.parentId;
      }
    };

    for (const node of byId.values()) {
      if (node.name.toLowerCase().includes(needle)) {
        keep.add(node.id);
        keepAncestors(node);
        keepDescendants(node);
      }
    }

    const prune = (nodes: CategoryTreeNode[]): CategoryTreeNode[] =>
      nodes
        .filter((node) => keep.has(node.id))
        .map((node) => ({ ...node, children: prune(node.children) }));

    return prune(roots);
  }

  private async findOrThrow(id: number): Promise<Category> {
    const category = await this.databaseService.category.findOne({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  private async findParentOrThrow(
    parentId: number,
    selfId?: number,
  ): Promise<Category> {
    if (parentId === selfId) {
      throw new BadRequestException(
        'A category cannot be its own parent',
      );
    }

    const parent = await this.databaseService.category.findOne({
      where: { id: parentId },
    });
    if (!parent) {
      throw new BadRequestException('Parent category not found');
    }

    if (selfId !== undefined) {
      let cursor: number | null = parent.parentId;
      while (cursor !== null) {
        if (cursor === selfId) {
          throw new BadRequestException(
            'This parent change would create a circular category hierarchy',
          );
        }
        const ancestor: Category | null =
          await this.databaseService.category.findOne({
            where: { id: cursor },
          });
        cursor = ancestor ? ancestor.parentId : null;
      }
    }

    return parent;
  }

  private async assertNameIsUnique(name: string, excludeId?: number) {
    const existing = await this.databaseService.category.findOne({
      where: {
        name: ILike(name),
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
    });
    if (existing) {
      throw new BadRequestException(
        'A category with this name already exists',
      );
    }
  }
}
