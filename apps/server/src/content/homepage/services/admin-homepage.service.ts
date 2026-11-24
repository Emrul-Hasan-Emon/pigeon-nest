import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { HomepageSection } from '../../../database/entities/homepage/homepage-section.entity';
import { HomepageLayout } from '../../../database/enums/homepage-layout.enum';
import { HomepageDeviceVisibility } from '../../../database/enums/homepage-device-visibility.enum';
import {
  HOMEPAGE_MAIN_MAX_SECTIONS,
  HomepagePage,
} from '../../../database/enums/homepage-page.enum';
import { CursorPagination } from '../../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../../shared/utils/cursor-paginate.util';
import { applyDisplayOrderCursor } from '../../../shared/utils/display-order-cursor.util';
import { likeContains } from '../../../shared/utils/like.util';
import {
  CreateHomepageSectionDto,
  HomepageSchedule,
  HomepageSort,
  ListHomepageSectionQueryDto,
  UpdateHomepageSectionDto,
  UpdateHomepageSlotDto,
} from '../dtos/homepage-section.dtos';
import { SECTION_DEFINITIONS } from '../registry/section-registry';
import { CommonHomepageService, Device } from './common-homepage.service';

/** What an admin does with homepage sections and slots: list, read, create, change, reorder and preview them. */
@Injectable()
export class AdminHomepageService {
  constructor(
    private readonly db: DatabaseService,
    private readonly common: CommonHomepageService,
  ) {}

  sectionTypes() {
    return Object.values(SECTION_DEFINITIONS);
  }

  async list(
    page: HomepagePage,
    query: ListHomepageSectionQueryDto,
    pagination: CursorPagination,
    defaultSort: HomepageSort,
  ) {
    const qb = this.db.homepageSection
      .createQueryBuilder('s')
      .where('s.page = :page', { page })
      .take(pagination.limit);

    const sort = query.sort ?? defaultSort;
    if (sort === HomepageSort.DISPLAY_ORDER) {
      applyDisplayOrderCursor(qb, 's', 'homepage_section', pagination.cursor);
    } else {
      qb.orderBy('s.id', 'DESC');
      if (pagination.cursor > 0) {
        qb.andWhere('s.id < :cursor', { cursor: pagination.cursor });
      }
    }

    if (query.search) {
      qb.andWhere('s.title ILIKE :search', { search: likeContains(query.search) });
    }
    if (query.sectionType) {
      qb.andWhere('s.sectionType = :type', { type: query.sectionType });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('s.isActive = :isActive', { isActive: query.isActive });
    }
    if (query.deviceVisibility) {
      qb.andWhere('s.deviceVisibility = :dv', { dv: query.deviceVisibility });
    }
    if (query.schedule === HomepageSchedule.LIVE) {
      qb.andWhere('s.isActive = true')
        .andWhere('(s.startsAt IS NULL OR s.startsAt <= now())')
        .andWhere('(s.endsAt IS NULL OR s.endsAt > now())');
    } else if (query.schedule === HomepageSchedule.SCHEDULED) {
      qb.andWhere('s.startsAt > now()');
    } else if (query.schedule === HomepageSchedule.EXPIRED) {
      qb.andWhere('s.endsAt <= now()');
    }

    return getCursorPaginateData(await qb.getMany(), pagination.limit);
  }

  async details(id: number, page: HomepagePage) {
    const section = await this.findOrThrow(id, page);
    const enriched = await this.common.enrich(
      section.sectionType,
      section.config,
    );
    return { ...section, entities: enriched.entities, warnings: enriched.warnings };
  }

  async create(dto: CreateHomepageSectionDto) {
    const definition = this.common.definitionOrThrow(dto.sectionType);
    this.assertWindow(dto.startsAt, dto.endsAt);
    const config = await this.common.normalize(dto.sectionType, dto.config);

    const count = await this.db.homepageSection.count({
      where: { page: HomepagePage.MAIN },
    });
    if (count >= HOMEPAGE_MAIN_MAX_SECTIONS) {
      throw new ConflictException(
        `The homepage can have at most ${HOMEPAGE_MAIN_MAX_SECTIONS} sections`,
      );
    }

    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const row = await this.db.homepageSection
        .createQueryBuilder('s')
        .select('COALESCE(MAX(s.sortOrder), -1)', 'max')
        .where('s.page = :page', { page: HomepagePage.MAIN })
        .getRawOne<{ max: string }>();
      sortOrder = Number(row?.max ?? -1) + 1;
    }

    const saved = await this.db.homepageSection.save(
      this.db.homepageSection.create({
        page: HomepagePage.MAIN,
        slotNo: null,
        sectionType: dto.sectionType,
        title: dto.title ?? definition.defaultTitle,
        config,
        layout: dto.layout ?? HomepageLayout.CAROUSEL,
        deviceVisibility: dto.deviceVisibility ?? HomepageDeviceVisibility.BOTH,
        sortOrder,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        isActive: dto.isActive ?? true,
      }),
    );
    return this.details(saved.id, HomepagePage.MAIN);
  }

  async update(
    id: number,
    dto: UpdateHomepageSectionDto | UpdateHomepageSlotDto,
    page: HomepagePage,
  ) {
    const section = await this.findOrThrow(id, page);

    const typeChanged =
      dto.sectionType !== undefined && dto.sectionType !== section.sectionType;
    if (typeChanged && dto.config === undefined) {
      throw new BadRequestException(
        'config is required when sectionType changes',
      );
    }
    const type = dto.sectionType ?? section.sectionType;
    if (dto.config !== undefined || typeChanged) {
      section.config = await this.common.normalize(type, dto.config);
    }
    section.sectionType = type;

    const startsAt =
      dto.startsAt === undefined
        ? section.startsAt
        : dto.startsAt
          ? new Date(dto.startsAt)
          : null;
    const endsAt =
      dto.endsAt === undefined
        ? section.endsAt
        : dto.endsAt
          ? new Date(dto.endsAt)
          : null;
    this.assertWindow(startsAt, endsAt);
    section.startsAt = startsAt;
    section.endsAt = endsAt;

    if (dto.title !== undefined) section.title = dto.title;
    if (dto.layout !== undefined) section.layout = dto.layout;
    if (dto.deviceVisibility !== undefined) {
      section.deviceVisibility = dto.deviceVisibility;
    }
    if (dto.isActive !== undefined) section.isActive = dto.isActive;
    if ('sortOrder' in dto && dto.sortOrder !== undefined) {
      section.sortOrder = dto.sortOrder;
    }

    await this.db.homepageSection.save(section);
    return this.details(id, page);
  }

  async reorder(ids: number[]) {
    const sections = await this.db.homepageSection.find({
      where: { page: HomepagePage.MAIN },
      select: { id: true },
    });
    const existing = new Set(sections.map((s) => s.id));
    const sameSet =
      ids.length === existing.size && ids.every((id) => existing.has(id));
    if (!sameSet) {
      throw new BadRequestException(
        'ids must list every homepage section exactly once',
      );
    }
    await this.db.homepageSection.manager.transaction(async (manager) => {
      for (let i = 0; i < ids.length; i++) {
        await manager.update(HomepageSection, { id: ids[i] }, { sortOrder: i });
      }
    });
    return { ids };
  }

  async remove(id: number) {
    await this.findOrThrow(id, HomepagePage.MAIN);
    await this.db.homepageSection.softDelete(id);
  }

  async preview(id: number, page: HomepagePage, device: Device = 'web') {
    const section = await this.findOrThrow(id, page);
    const resolved = await this.common.resolve(section, device);
    return {
      ...resolved,
      device,
      visible: this.common.isVisible(section, device),
    };
  }

  private async findOrThrow(id: number, page: HomepagePage) {
    const section = await this.db.homepageSection.findOne({
      where: { id, page },
    });
    if (!section) throw new NotFoundException('Homepage section not found');
    return section;
  }

  private assertWindow(
    startsAt?: string | Date | null,
    endsAt?: string | Date | null,
  ) {
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
  }
}
