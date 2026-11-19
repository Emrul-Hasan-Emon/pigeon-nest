import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../../database/database.service';
import { SellerActiveStatus } from '../../database/enums/seller-active-status.enum';
import { SellerStatus } from '../../database/enums/seller-status.enum';
import { CreateSellerDto } from '../dtos/create-seller.dto';
import { UpdateSellerDto } from '../dtos/update-seller.dto';
import { ListSellerQueryDto } from '../dtos/list-seller-query.dto';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { likeContains } from '../../shared/utils/like.util';
import { CommonSellerService, SellerImages } from './common-seller.service';

@Injectable()
export class AdminSellerService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly commonSellerService: CommonSellerService,
  ) {}

  async list(query: ListSellerQueryDto, pagination: CursorPagination) {
    const qb = this.databaseService.seller
      .createQueryBuilder('seller')
      .orderBy('seller.id', 'DESC')
      .take(pagination.limit);

    if (query.search) {
      qb.andWhere(
        '(seller.name ILIKE :search OR seller.email ILIKE :search OR seller.phone ILIKE :search)',
        { search: likeContains(query.search) },
      );
    }
    if (query.status !== undefined) {
      qb.andWhere('seller.status = :status', { status: query.status });
    }
    if (query.activeStatus !== undefined) {
      qb.andWhere('seller.activeStatus = :activeStatus', {
        activeStatus: query.activeStatus,
      });
    }
    if (pagination.cursor > 0) {
      qb.andWhere('seller.id < :cursor', { cursor: pagination.cursor });
    }

    const results = await qb.getMany();
    const page = getCursorPaginateData(results, pagination.limit);

    return {
      ...page,
      results: page.results.map((seller) =>
        this.commonSellerService.toSafeSeller(seller),
      ),
    };
  }

  async details(id: number) {
    return this.commonSellerService.toSafeSeller(
      await this.commonSellerService.findOrThrow(id),
    );
  }

  async create(dto: CreateSellerDto, images?: SellerImages) {
    await this.commonSellerService.assertEmailIsUnique(dto.email);
    await this.commonSellerService.assertPhoneIsUnique(dto.phone);

    const seller = this.databaseService.seller.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      passwordHash: await bcrypt.hash(dto.password, 10),
      commissionRate: dto.commissionRate ?? 0,
      payoutAccountInfo: dto.payoutAccountInfo ?? null,
      status: SellerStatus.APPROVED,
      activeStatus: SellerActiveStatus.ACTIVE,
    });

    return this.commonSellerService.toSafeSeller(
      await this.commonSellerService.saveWithImages(seller, images),
    );
  }

  async update(id: number, dto: UpdateSellerDto, images?: SellerImages) {
    const seller = await this.commonSellerService.findOrThrow(id);

    if (dto.name !== undefined) {
      seller.name = dto.name;
    }
    if (
      dto.email !== undefined &&
      dto.email.toLowerCase() !== seller.email?.toLowerCase()
    ) {
      await this.commonSellerService.assertEmailIsUnique(dto.email, id);
      seller.email = dto.email;
    }
    if (dto.phone !== undefined && dto.phone !== seller.phone) {
      await this.commonSellerService.assertPhoneIsUnique(dto.phone, id);
      seller.phone = dto.phone;
    }
    if (dto.password !== undefined) {
      seller.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    if (dto.commissionRate !== undefined) {
      seller.commissionRate = dto.commissionRate;
    }
    if (dto.payoutAccountInfo !== undefined) {
      seller.payoutAccountInfo = dto.payoutAccountInfo;
    }
    if (dto.status !== undefined) {
      seller.status = dto.status;
      if (dto.status === SellerStatus.APPROVED) {
        seller.rejectionReason = null;
      }
    }
    if (dto.rejectionReason !== undefined) {
      seller.rejectionReason = dto.rejectionReason;
    }
    if (dto.activeStatus !== undefined) {
      seller.activeStatus = dto.activeStatus;
    }

    return this.commonSellerService.toSafeSeller(
      await this.commonSellerService.saveWithImages(seller, images),
    );
  }
}
