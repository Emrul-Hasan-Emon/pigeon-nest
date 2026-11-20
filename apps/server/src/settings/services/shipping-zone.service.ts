import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ShippingZone } from '../../database/entities/zone/shipping-zone.entity';
import { DeliveryType } from '../../database/enums/delivery-type.enum';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { likeContains } from '../../shared/utils/like.util';
import {
  CreateShippingZoneDto,
  ListShippingZoneQueryDto,
  UpdateShippingZoneDto,
} from '../dtos/shipping-zone.dtos';
import { COUNTRY_CODES, countryName } from '../utils/countries';
import { SystemSettingsService } from './system-settings.service';

export interface ShippingQuote {
  charge: number;
  estimatedDays: number;
  supportsLiveAnimal: boolean;
  /** `zone`: an active zone covers the destination. `default`: the global settings apply. */
  source: 'zone' | 'default';
  zone: { id: number; name: string } | null;
}

@Injectable()
export class ShippingZoneService {
  constructor(
    private readonly db: DatabaseService,
    private readonly settings: SystemSettingsService,
  ) {}

  async list(query: ListShippingZoneQueryDto, pagination: CursorPagination) {
    const qb = this.db.shippingZone
      .createQueryBuilder('z')
      .orderBy('z.id', 'DESC')
      .take(pagination.limit);
    if (pagination.cursor > 0) qb.andWhere('z.id < :cursor', { cursor: pagination.cursor });
    if (query.search) qb.andWhere('z.name ILIKE :q', { q: likeContains(query.search) });
    if (query.deliveryType) qb.andWhere('z.deliveryType = :dt', { dt: query.deliveryType });
    if (query.isActive !== undefined) qb.andWhere('z.isActive = :a', { a: query.isActive });
    if (query.country) {
      qb.andWhere('z.countryCodes @> CAST(:c AS jsonb)', { c: JSON.stringify([query.country]) });
    }
    const page = getCursorPaginateData(await qb.getMany(), pagination.limit);
    return { ...page, results: page.results.map((z) => this.view(z)) };
  }

  async details(id: number) {
    return this.view(await this.findOrThrow(id), true);
  }

  async create(dto: CreateShippingZoneDto) {
    this.assertCountries(dto.countryCodes);
    const isActive = dto.isActive ?? true;
    if (isActive) await this.assertNoOverlap(dto.deliveryType, dto.countryCodes);
    const saved = await this.db.shippingZone.save(
      this.db.shippingZone.create({
        name: dto.name,
        deliveryType: dto.deliveryType,
        countryCodes: dto.countryCodes,
        charge: dto.charge,
        estimatedDays: dto.estimatedDays,
        supportsLiveAnimal: dto.supportsLiveAnimal ?? true,
        isActive,
      }),
    );
    return this.view(saved, true);
  }

  async update(id: number, dto: UpdateShippingZoneDto) {
    const zone = await this.findOrThrow(id);
    if (dto.countryCodes) this.assertCountries(dto.countryCodes);

    const next = {
      deliveryType: dto.deliveryType ?? zone.deliveryType,
      countryCodes: dto.countryCodes ?? zone.countryCodes,
      isActive: dto.isActive ?? zone.isActive,
    };
    if (next.isActive) await this.assertNoOverlap(next.deliveryType, next.countryCodes, id);

    if (dto.name !== undefined) zone.name = dto.name;
    zone.deliveryType = next.deliveryType;
    zone.countryCodes = next.countryCodes;
    zone.isActive = next.isActive;
    if (dto.charge !== undefined) zone.charge = dto.charge;
    if (dto.estimatedDays !== undefined) zone.estimatedDays = dto.estimatedDays;
    if (dto.supportsLiveAnimal !== undefined) zone.supportsLiveAnimal = dto.supportsLiveAnimal;
    return this.view(await this.db.shippingZone.save(zone), true);
  }

  async remove(id: number) {
    await this.findOrThrow(id);
    // Orders keep their own copy of the charge, so nothing refers to a zone.
    await this.db.shippingZone.delete(id);
  }

  /** What delivering to `country` with `deliveryType` costs: the zone that covers it, else the global defaults. */
  async quote(country: string, deliveryType: DeliveryType): Promise<ShippingQuote> {
    const zone = await this.db.shippingZone
      .createQueryBuilder('z')
      .where('z.isActive = true')
      .andWhere('z.deliveryType = :dt', { dt: deliveryType })
      .andWhere('z.countryCodes @> CAST(:c AS jsonb)', { c: JSON.stringify([country]) })
      .orderBy('z.id', 'ASC')
      .getOne();
    if (zone) {
      return {
        charge: Number(zone.charge),
        estimatedDays: zone.estimatedDays,
        supportsLiveAnimal: zone.supportsLiveAnimal,
        source: 'zone',
        zone: { id: zone.id, name: zone.name },
      };
    }
    return {
      charge: await this.settings.getNumber('shipping.defaultCharge'),
      estimatedDays: await this.settings.getNumber('shipping.defaultEstimatedDays'),
      supportsLiveAnimal: await this.settings.getBoolean('shipping.defaultSupportsLiveAnimal'),
      source: 'default',
      zone: null,
    };
  }

  private async findOrThrow(id: number) {
    const zone = await this.db.shippingZone.findOne({ where: { id } });
    if (!zone) throw new NotFoundException('Shipping zone not found');
    return zone;
  }

  private assertCountries(codes: string[]) {
    const unknown = codes.filter((c) => !COUNTRY_CODES.has(c));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown country code(s): ${unknown.join(', ')}`);
    }
  }

  /** A country can have one active zone per delivery type, so a quote is never ambiguous. */
  private async assertNoOverlap(deliveryType: DeliveryType, codes: string[], exceptId?: number) {
    const qb = this.db.shippingZone
      .createQueryBuilder('z')
      .where('z.isActive = true')
      .andWhere('z.deliveryType = :dt', { dt: deliveryType });
    if (exceptId) qb.andWhere('z.id <> :id', { id: exceptId });
    const others = await qb.getMany();
    for (const other of others) {
      const shared = other.countryCodes.filter((c) => codes.includes(c));
      if (shared.length > 0) {
        throw new ConflictException(
          `Zone "${other.name}" already covers ${shared.slice(0, 5).join(', ')}${shared.length > 5 ? ` and ${shared.length - 5} more` : ''} for ${deliveryType} delivery`,
        );
      }
    }
  }

  private view(z: ShippingZone, withNames = false) {
    return {
      id: z.id,
      name: z.name,
      deliveryType: z.deliveryType,
      countryCodes: z.countryCodes,
      ...(withNames
        ? { countries: z.countryCodes.map((code) => ({ code, name: countryName(code) })) }
        : {}),
      charge: Number(z.charge),
      estimatedDays: z.estimatedDays,
      supportsLiveAnimal: z.supportsLiveAnimal,
      isActive: z.isActive,
      createdAt: z.createdAt,
      updatedAt: z.updatedAt,
    };
  }
}
