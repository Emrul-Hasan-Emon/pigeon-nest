import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { DatabaseService } from '../../database/database.service';
import { FileUploadService } from '../../file-management/file-upload.service';
import { FileInfo } from '../../file-management/types/file-info.type';
import { Seller } from '../../database/entities/seller/seller.entity';
import { getSellerAccess } from '../../auth/policies/seller-access.policy';
import { assertUploadAllowed } from '../../shared/utils/upload-validation.util';

const NID_FOLDER = 'sellers/nid';
const AVATAR_FOLDER = 'sellers/avatars';
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export interface SellerImages {
  avatar?: Express.Multer.File;
  nidFrontImage?: Express.Multer.File;
  nidBackImage?: Express.Multer.File;
}

const IMAGE_FIELDS = [
  ['avatar', 'avatarPath', 'avatarUrl', AVATAR_FOLDER],
  ['nidFrontImage', 'nidFrontImagePath', 'nidFrontImageUrl', NID_FOLDER],
  ['nidBackImage', 'nidBackImagePath', 'nidBackImageUrl', NID_FOLDER],
] as const;

// Logic shared by the admin seller APIs, seller self-service and registration.
@Injectable()
export class CommonSellerService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  async findOrThrow(id: number): Promise<Seller> {
    const seller = await this.databaseService.seller.findOne({ where: { id } });
    if (!seller) {
      throw new NotFoundException('Seller not found');
    }
    return seller;
  }

  async assertEmailIsUnique(email?: string | null, excludeId?: number) {
    if (!email) return;
    const qb = this.databaseService.seller
      .createQueryBuilder('seller')
      .where('LOWER(seller.email) = LOWER(:email)', { email });
    if (excludeId) qb.andWhere('seller.id != :excludeId', { excludeId });
    if (await qb.getExists()) {
      throw new BadRequestException('A seller with this email already exists');
    }
  }

  async assertPhoneIsUnique(phone?: string | null, excludeId?: number) {
    if (!phone) return;
    const qb = this.databaseService.seller
      .createQueryBuilder('seller')
      .where('seller.phone = :phone', { phone });
    if (excludeId) qb.andWhere('seller.id != :excludeId', { excludeId });
    if (await qb.getExists()) {
      throw new BadRequestException('A seller with this phone already exists');
    }
  }

  // Validates the images, uploads them, saves the seller, then deletes the
  // replaced files. If saving fails the new uploads are removed again, so a
  // failure never leaves orphans or loses the old files.
  async saveWithImages(seller: Seller, images?: SellerImages): Promise<Seller> {
    for (const [field] of IMAGE_FIELDS) {
      const file = images?.[field];
      if (!file) continue;
      assertUploadAllowed(file, ['image']);
      if (file.size > IMAGE_MAX_BYTES) {
        throw new PayloadTooLargeException(`${field} must be 10MB or smaller`);
      }
    }

    const uploaded: FileInfo[] = [];
    const stalePaths: string[] = [];
    try {
      for (const [field, pathKey, urlKey, folder] of IMAGE_FIELDS) {
        const file = images?.[field];
        if (!file) continue;
        const info = await this.fileUploadService.uploadFile(file, folder);
        uploaded.push(info);
        if (seller[pathKey]) stalePaths.push(seller[pathKey]);
        seller[pathKey] = info.filePath;
        seller[urlKey] = info.fileUrl;
      }
      const saved = await this.databaseService.seller.save(seller);
      for (const path of stalePaths) {
        await this.fileUploadService.removeFile(path).catch(() => undefined);
      }
      return saved;
    } catch (error) {
      await this.fileUploadService.removeFiles(uploaded).catch(() => undefined);
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string } | undefined)?.code === '23505'
      ) {
        throw new BadRequestException(
          'A seller with this phone or email already exists',
        );
      }
      throw error;
    }
  }

  toSafeSeller(seller: Seller) {
    const { passwordHash: _passwordHash, ...safe } = seller;
    return safe;
  }

  // What a seller sees about themselves: safe fields + what they may do.
  toSellerView(seller: Seller) {
    return { ...this.toSafeSeller(seller), access: getSellerAccess(seller) };
  }
}
