import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ILike, Not } from 'typeorm';
import { DatabaseService } from '../../../database/database.service';
import { FileUploadService } from '../../../file-management/file-upload.service';
import { Collection } from '../../../database/entities/collection/collection.entity';
import { CreateCollectionDto } from '../dtos/create-collection.dto';
import { UpdateCollectionDto } from '../dtos/update-collection.dto';
import { ListCollectionQueryDto } from '../dtos/list-collection-query.dto';
import { slugify } from '../../../shared/utils/slugify.util';
import { CursorPagination } from '../../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../../shared/utils/cursor-paginate.util';

const IMAGE_FOLDER = 'collections';

@Injectable()
export class AdminCollectionService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  async list(query: ListCollectionQueryDto, pagination: CursorPagination) {
    const qb = this.databaseService.collection
      .createQueryBuilder('collection')
      .orderBy('collection.id', 'DESC')
      .take(pagination.limit);

    if (query.search) {
      qb.andWhere('collection.name ILIKE :search', { search: `%${query.search}%` });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('collection.isActive = :isActive', { isActive: query.isActive });
    }
    if (pagination.cursor > 0) {
      qb.andWhere('collection.id < :cursor', { cursor: pagination.cursor });
    }

    const results = await qb.getMany();
    return getCursorPaginateData(results, pagination.limit);
  }

  async create(dto: CreateCollectionDto, image?: Express.Multer.File) {
    await this.assertNameIsUnique(dto.name);

    const collection = this.databaseService.collection.create({
      name: dto.name,
      slug: slugify(dto.name),
      description: dto.description,
      colorCode: dto.colorCode,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });

    if (image) {
      const fileInfo = await this.fileUploadService.uploadFile(
        image,
        IMAGE_FOLDER,
      );
      collection.imagePath = fileInfo.filePath;
      collection.imageUrl = fileInfo.fileUrl;
    }

    return this.databaseService.collection.save(collection);
  }

  async update(
    id: number,
    dto: UpdateCollectionDto,
    image?: Express.Multer.File,
  ) {
    const collection = await this.findOrThrow(id);

    if (dto.name !== undefined && dto.name !== collection.name) {
      await this.assertNameIsUnique(dto.name, id);
      collection.name = dto.name;
      collection.slug = slugify(dto.name);
    }

    if (dto.description !== undefined) {
      collection.description = dto.description;
    }
    if (dto.colorCode !== undefined) {
      collection.colorCode = dto.colorCode;
    }
    if (dto.sortOrder !== undefined) {
      collection.sortOrder = dto.sortOrder;
    }
    if (dto.isActive !== undefined) {
      collection.isActive = dto.isActive;
    }

    if (image) {
      if (collection.imagePath) {
        await this.fileUploadService.removeFile(collection.imagePath);
      }
      const fileInfo = await this.fileUploadService.uploadFile(
        image,
        IMAGE_FOLDER,
      );
      collection.imagePath = fileInfo.filePath;
      collection.imageUrl = fileInfo.fileUrl;
    }

    return this.databaseService.collection.save(collection);
  }

  async remove(id: number) {
    const collection = await this.findOrThrow(id);

    const productCount = await this.databaseService.sellerProduct.count({
      where: { collectionId: id },
    });
    if (productCount > 0) {
      throw new ConflictException(
        'Collection is still referenced by products and cannot be deleted',
      );
    }

    const sectionCount = await this.databaseService.homepageSection
      .createQueryBuilder('section')
      .where(
        `(section.config -> 'collectionIds' @> CAST(:ids AS jsonb) OR section.config -> 'collectionId' = CAST(:id AS jsonb))`,
        { ids: JSON.stringify([id]), id: JSON.stringify(id) },
      )
      .getCount();
    if (sectionCount > 0) {
      throw new ConflictException(
        'Collection is used by a homepage section and cannot be deleted',
      );
    }

    await this.databaseService.collection.delete(id);

    if (collection.imagePath) {
      await this.fileUploadService.removeFile(collection.imagePath);
    }
  }

  private async findOrThrow(id: number): Promise<Collection> {
    const collection = await this.databaseService.collection.findOne({
      where: { id },
    });
    if (!collection) {
      throw new NotFoundException('Collection not found');
    }
    return collection;
  }

  private async assertNameIsUnique(name: string, excludeId?: number) {
    const existing = await this.databaseService.collection.findOne({
      where: {
        name: ILike(name),
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
    });
    if (existing) {
      throw new BadRequestException(
        'A collection with this name already exists',
      );
    }
  }
}
