import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { getUserAccess } from '../../auth/policies/user-access.policy';
import { DatabaseService } from '../../database/database.service';
import { Address } from '../../database/entities/person/address.entity';
import { AddressType } from '../../database/enums/address-type.enum';
import { countryName } from '../../settings/utils/countries';
import { Actor } from '../../shared/types/actor.type';
import { CreateAddressDto, UpdateAddressDto } from '../dtos/address.dtos';

export const MAX_ADDRESSES = 20;

/** A customer's saved addresses. The customer manages their own; an admin can manage them on the customer's behalf. */
@Injectable()
export class AddressService {
  constructor(private readonly db: DatabaseService) {}

  async list(userId: number) {
    const rows = await this.db.address.find({ where: { userId }, order: { isDefault: 'DESC', id: 'DESC' } });
    return { results: rows.map((a) => this.view(a)) };
  }

  async get(userId: number, id: number) {
    return this.view(await this.findOrThrow(userId, id));
  }

  async create(userId: number, dto: CreateAddressDto, actor: Actor) {
    const saved = await this.db.address.manager.transaction(async (manager) => {
      // The customer row serialises changes to their addresses (one default, a cap on the count).
      await manager.query(`SELECT id FROM "user" WHERE id = $1 FOR UPDATE`, [userId]);
      const existing = await manager.count(Address, { where: { userId } });
      if (existing >= MAX_ADDRESSES) {
        throw new ConflictException(`A customer can save at most ${MAX_ADDRESSES} addresses. Delete one first.`);
      }
      // The first address is the default; asking for a default replaces the old one.
      const makeDefault = existing === 0 || dto.isDefault === true;
      if (makeDefault) await manager.update(Address, { userId, isDefault: true }, { isDefault: false });
      return manager.save(Address, {
        userId,
        type: dto.type ?? AddressType.SHIPPING,
        recipientName: dto.recipientName,
        phone: dto.phone,
        countryCode: dto.countryCode,
        state: dto.state ?? null,
        city: dto.city,
        address: dto.address,
        zipCode: dto.zipCode ?? null,
        isDefault: makeDefault,
        createdBy: actor.id,
        creatorType: actor.type,
        creatorName: actor.name,
      });
    });
    return this.view(saved);
  }

  async update(userId: number, id: number, dto: UpdateAddressDto, actor: Actor) {
    await this.db.address.manager.transaction(async (manager) => {
      await manager.query(`SELECT id FROM "user" WHERE id = $1 FOR UPDATE`, [userId]);
      const address = await manager.findOne(Address, { where: { id, userId } });
      if (!address) throw new NotFoundException('Address not found');
      if (dto.isDefault === true && !address.isDefault) {
        await manager.update(Address, { userId, isDefault: true }, { isDefault: false });
      }
      const { isDefault, ...fields } = dto;
      await manager.update(Address, id, {
        ...fields,
        // The default cannot be switched off directly: choose another address as the default instead.
        ...(isDefault === true ? { isDefault: true } : {}),
        updatedBy: actor.id,
        updaterType: actor.type,
        updaterName: actor.name,
      });
    });
    return this.get(userId, id);
  }

  async remove(userId: number, id: number, actor: Actor) {
    await this.db.address.manager.transaction(async (manager) => {
      await manager.query(`SELECT id FROM "user" WHERE id = $1 FOR UPDATE`, [userId]);
      const address = await manager.findOne(Address, { where: { id, userId } });
      if (!address) throw new NotFoundException('Address not found');
      await manager.update(Address, id, {
        isDefault: false,
        updatedBy: actor.id,
        updaterType: actor.type,
        updaterName: actor.name,
      });
      await manager.softDelete(Address, id);
      // Deleting the default hands the role to the newest address that is left.
      if (address.isDefault) {
        const next = await manager.findOne(Address, { where: { userId }, order: { id: 'DESC' } });
        if (next) await manager.update(Address, next.id, { isDefault: true });
      }
    });
  }

  async ensureUser(userId: number) {
    const user = await this.db.user.findOne({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
  }

  /** For someone saving an address on a customer's behalf: the account must exist and be usable. */
  async ensureActiveUser(userId: number) {
    const user = await this.db.user.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!getUserAccess(user).canUse) throw new BadRequestException('That customer account is suspended');
  }

  private async findOrThrow(userId: number, id: number) {
    const address = await this.db.address.findOne({ where: { id, userId } });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  private view(a: Address) {
    return {
      id: a.id,
      userId: a.userId,
      type: a.type,
      recipientName: a.recipientName,
      phone: a.phone,
      countryCode: a.countryCode,
      countryName: countryName(a.countryCode),
      state: a.state,
      city: a.city,
      address: a.address,
      zipCode: a.zipCode,
      isDefault: a.isDefault,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }
}
