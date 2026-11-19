import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ILike, In, Not } from 'typeorm';
import { DatabaseService } from '../../../database/database.service';
import { Attribute } from '../../../database/entities/attribute/attribute.entity';
import { AttributeValue } from '../../../database/entities/attribute/attribute-value.entity';
import { CreateAttributeDto } from '../dtos/create-attribute.dto';
import { UpdateAttributeDto } from '../dtos/update-attribute.dto';
import { ListAttributeQueryDto } from '../dtos/list-attribute-query.dto';
import { CreateAttributeValueDto } from '../dtos/create-attribute-value.dto';
import { UpdateAttributeValueDto } from '../dtos/update-attribute-value.dto';
import { slugify } from '../../../shared/utils/slugify.util';
import { CursorPagination } from '../../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../../shared/utils/cursor-paginate.util';

@Injectable()
export class AdminAttributeService {
  constructor(private readonly databaseService: DatabaseService) {}

  async list(query: ListAttributeQueryDto, pagination: CursorPagination) {
    const idQb = this.databaseService.attribute
      .createQueryBuilder('attribute')
      .select('attribute.id')
      .orderBy('attribute.id', 'DESC')
      .take(pagination.limit);

    if (query.search) {
      idQb.andWhere('attribute.name ILIKE :search', { search: `%${query.search}%` });
    }
    if (query.isActive !== undefined) {
      idQb.andWhere('attribute.isActive = :isActive', { isActive: query.isActive });
    }
    if (pagination.cursor > 0) {
      idQb.andWhere('attribute.id < :cursor', { cursor: pagination.cursor });
    }

    const rows = await idQb.getMany();
    const page = getCursorPaginateData(rows, pagination.limit);
    if (page.results.length === 0) {
      return page;
    }

    // Re-fetch with relations — joining values directly above would make
    // take() count joined rows instead of attributes.
    const byId = new Map(
      (
        await this.databaseService.attribute.find({
          where: { id: In(page.results.map((row) => row.id)) },
          relations: { values: true },
        })
      ).map((attribute) => [attribute.id, attribute]),
    );

    return {
      ...page,
      results: page.results.map((row) => byId.get(row.id) as Attribute),
    };
  }

  async create(dto: CreateAttributeDto) {
    await this.assertNameIsUnique(dto.name);

    const attribute = await this.databaseService.attribute.save(
      this.databaseService.attribute.create({
        name: dto.name,
        slug: slugify(dto.name),
        description: dto.description,
        isActive: dto.isActive ?? true,
      }),
    );

    if (dto.values?.length) {
      await this.saveValues(attribute.id, dto.values);
    }

    return this.findOrThrow(attribute.id);
  }

  async update(id: number, dto: UpdateAttributeDto) {
    const attribute = await this.findOrThrow(id);

    if (dto.name !== undefined && dto.name !== attribute.name) {
      await this.assertNameIsUnique(dto.name, id);
      attribute.name = dto.name;
      attribute.slug = slugify(dto.name);
    }
    if (dto.description !== undefined) {
      attribute.description = dto.description;
    }
    if (dto.isActive !== undefined) {
      attribute.isActive = dto.isActive;
    }

    return this.databaseService.attribute.save(attribute);
  }

  async remove(id: number) {
    await this.findOrThrow(id);

    const variantCount =
      await this.databaseService.sellerProductSkuVariant.count({
        where: { attributeId: id },
      });
    if (variantCount > 0) {
      throw new ConflictException(
        'Attribute is still referenced by product variants and cannot be deleted',
      );
    }

    await this.databaseService.attribute.delete(id);
  }

  async listValues(attributeId: number) {
    await this.findOrThrow(attributeId);
    return this.databaseService.attributeValue.find({
      where: { attributeId },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async createValue(attributeId: number, dto: CreateAttributeValueDto) {
    await this.findOrThrow(attributeId);
    const [value] = await this.saveValues(attributeId, [dto]);
    return value;
  }

  async updateValue(valueId: number, dto: UpdateAttributeValueDto) {
    const value = await this.findValueOrThrow(valueId);

    if (dto.name !== undefined) {
      value.name = dto.name;
    }
    if (dto.description !== undefined) {
      value.description = dto.description;
    }
    if (dto.colorCode !== undefined) {
      value.colorCode = dto.colorCode;
    }
    if (dto.sortOrder !== undefined) {
      value.sortOrder = dto.sortOrder;
    }
    if (dto.isActive !== undefined) {
      value.isActive = dto.isActive;
    }

    return this.databaseService.attributeValue.save(value);
  }

  async removeValue(valueId: number) {
    await this.findValueOrThrow(valueId);

    const variantCount =
      await this.databaseService.sellerProductSkuVariant.count({
        where: { attributeValueId: valueId },
      });
    if (variantCount > 0) {
      throw new ConflictException(
        'Attribute value is still referenced by product variants and cannot be deleted',
      );
    }

    await this.databaseService.attributeValue.delete(valueId);
  }

  private saveValues(attributeId: number, values: CreateAttributeValueDto[]) {
    return this.databaseService.attributeValue.save(
      values.map((value) =>
        this.databaseService.attributeValue.create({
          attributeId,
          name: value.name,
          description: value.description,
          colorCode: value.colorCode,
          sortOrder: value.sortOrder ?? 0,
          isActive: value.isActive ?? true,
        }),
      ),
    );
  }

  private async findOrThrow(id: number): Promise<Attribute> {
    const attribute = await this.databaseService.attribute.findOne({
      where: { id },
      relations: { values: true },
    });
    if (!attribute) {
      throw new NotFoundException('Attribute not found');
    }
    return attribute;
  }

  private async findValueOrThrow(id: number): Promise<AttributeValue> {
    const value = await this.databaseService.attributeValue.findOne({
      where: { id },
    });
    if (!value) {
      throw new NotFoundException('Attribute value not found');
    }
    return value;
  }

  private async assertNameIsUnique(name: string, excludeId?: number) {
    const existing = await this.databaseService.attribute.findOne({
      where: {
        name: ILike(name),
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
    });
    if (existing) {
      throw new BadRequestException(
        'An attribute with this name already exists',
      );
    }
  }
}
