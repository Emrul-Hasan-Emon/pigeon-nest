import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { FileUploadService } from '../../../file-management/file-upload.service';
import { FileInfo } from '../../../file-management/types/file-info.type';
import { Banner } from '../../../database/entities/banner/banner.entity';
import { CursorPagination } from '../../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../../shared/utils/cursor-paginate.util';
import { applyDisplayOrderCursor } from '../../../shared/utils/display-order-cursor.util';
import { likeContains } from '../../../shared/utils/like.util';
import { assertUploadAllowed } from '../../../shared/utils/upload-validation.util';
import { CreateBannerDto } from '../dtos/create-banner.dto';
import { UpdateBannerDto } from '../dtos/update-banner.dto';
import {
  BannerSchedule,
  BannerSort,
  ListBannerQueryDto,
} from '../dtos/list-banner-query.dto';

const BANNER_FOLDER = 'banners';
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export interface BannerFiles {
  image?: Express.Multer.File;
  mobileImage?: Express.Multer.File;
}

@Injectable()
export class AdminBannerService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  async list(query: ListBannerQueryDto, pagination: CursorPagination) {
    const qb = this.databaseService.banner
      .createQueryBuilder('banner')
      .take(pagination.limit);

    if (query.sort === BannerSort.DISPLAY_ORDER) {
      applyDisplayOrderCursor(qb, 'banner', 'banner', pagination.cursor);
    } else {
      qb.orderBy('banner.id', 'DESC');
      if (pagination.cursor > 0) {
        qb.andWhere('banner.id < :cursor', { cursor: pagination.cursor });
      }
    }

    if (query.search) {
      qb.andWhere('banner.title ILIKE :search', {
        search: likeContains(query.search),
      });
    }
    if (query.position) {
      qb.andWhere('banner.position = :position', { position: query.position });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('banner.isActive = :isActive', { isActive: query.isActive });
    }
    if (query.schedule === BannerSchedule.LIVE) {
      qb.andWhere('banner.isActive = true')
        .andWhere('(banner.startsAt IS NULL OR banner.startsAt <= now())')
        .andWhere('(banner.endsAt IS NULL OR banner.endsAt > now())');
    } else if (query.schedule === BannerSchedule.SCHEDULED) {
      qb.andWhere('banner.startsAt > now()');
    } else if (query.schedule === BannerSchedule.EXPIRED) {
      qb.andWhere('banner.endsAt <= now()');
    }

    return getCursorPaginateData(await qb.getMany(), pagination.limit);
  }

  details(id: number) {
    return this.findOrThrow(id);
  }

  async create(dto: CreateBannerDto, files: BannerFiles) {
    if (!files.image) {
      throw new BadRequestException('image is required');
    }
    this.assertImage(files.image);
    if (files.mobileImage) this.assertImage(files.mobileImage);
    this.assertWindow(dto.startsAt, dto.endsAt);

    const uploaded: FileInfo[] = [];
    try {
      const image = await this.fileUploadService.uploadFile(
        files.image,
        BANNER_FOLDER,
      );
      uploaded.push(image);
      const mobile = files.mobileImage
        ? await this.fileUploadService.uploadFile(
            files.mobileImage,
            BANNER_FOLDER,
          )
        : undefined;
      if (mobile) uploaded.push(mobile);

      return await this.databaseService.banner.save(
        this.databaseService.banner.create({
          title: dto.title,
          linkUrl: dto.linkUrl,
          position: dto.position,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
          endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
          imageUrl: image.fileUrl,
          imagePath: image.filePath,
          mobileImageUrl: mobile?.fileUrl,
          mobileImagePath: mobile?.filePath,
        }),
      );
    } catch (error) {
      await this.fileUploadService.removeFiles(uploaded).catch(() => undefined);
      throw error;
    }
  }

  async update(id: number, dto: UpdateBannerDto, files: BannerFiles) {
    const banner = await this.findOrThrow(id);

    if (files.image) this.assertImage(files.image);
    if (files.mobileImage) this.assertImage(files.mobileImage);
    if (files.mobileImage && dto.removeMobileImage) {
      throw new BadRequestException(
        'mobileImage and removeMobileImage cannot be used together',
      );
    }

    const startsAt =
      dto.startsAt === undefined ? banner.startsAt : toDate(dto.startsAt);
    const endsAt = dto.endsAt === undefined ? banner.endsAt : toDate(dto.endsAt);
    this.assertWindow(startsAt, endsAt);

    const stale: string[] = [];
    const uploaded: FileInfo[] = [];
    try {
      if (files.image) {
        const info = await this.fileUploadService.uploadFile(
          files.image,
          BANNER_FOLDER,
        );
        uploaded.push(info);
        if (banner.imagePath) stale.push(banner.imagePath);
        banner.imageUrl = info.fileUrl;
        banner.imagePath = info.filePath;
      }
      if (files.mobileImage) {
        const info = await this.fileUploadService.uploadFile(
          files.mobileImage,
          BANNER_FOLDER,
        );
        uploaded.push(info);
        if (banner.mobileImagePath) stale.push(banner.mobileImagePath);
        banner.mobileImageUrl = info.fileUrl;
        banner.mobileImagePath = info.filePath;
      } else if (dto.removeMobileImage) {
        if (banner.mobileImagePath) stale.push(banner.mobileImagePath);
        banner.mobileImageUrl = null as unknown as string;
        banner.mobileImagePath = null as unknown as string;
      }

      if (dto.title !== undefined) banner.title = dto.title;
      if (dto.linkUrl !== undefined) {
        banner.linkUrl = dto.linkUrl as unknown as string;
      }
      if (dto.position !== undefined) banner.position = dto.position;
      if (dto.sortOrder !== undefined) banner.sortOrder = dto.sortOrder;
      if (dto.isActive !== undefined) banner.isActive = dto.isActive;
      banner.startsAt = startsAt;
      banner.endsAt = endsAt;

      const saved = await this.databaseService.banner.save(banner);
      for (const path of stale) {
        await this.fileUploadService.removeFile(path).catch(() => undefined);
      }
      return saved;
    } catch (error) {
      await this.fileUploadService.removeFiles(uploaded).catch(() => undefined);
      throw error;
    }
  }

  async remove(id: number) {
    const banner = await this.findOrThrow(id);

    const usedBy = await this.databaseService.homepageSection
      .createQueryBuilder('section')
      .where(`section.config -> 'bannerIds' @> CAST(:ids AS jsonb)`, {
        ids: JSON.stringify([id]),
      })
      .getCount();
    if (usedBy > 0) {
      throw new ConflictException(
        'Banner is used by a homepage section and cannot be deleted',
      );
    }

    await this.databaseService.banner.delete(id);
    for (const path of [banner.imagePath, banner.mobileImagePath]) {
      if (path) {
        await this.fileUploadService.removeFile(path).catch(() => undefined);
      }
    }
  }

  private async findOrThrow(id: number): Promise<Banner> {
    const banner = await this.databaseService.banner.findOne({ where: { id } });
    if (!banner) {
      throw new NotFoundException('Banner not found');
    }
    return banner;
  }

  private assertImage(file: Express.Multer.File) {
    assertUploadAllowed(file, ['image']);
    if (file.size > IMAGE_MAX_BYTES) {
      throw new PayloadTooLargeException('Banner images must be 10MB or smaller');
    }
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

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}
