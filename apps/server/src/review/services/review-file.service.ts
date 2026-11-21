import { BadRequestException, Injectable } from '@nestjs/common';
import { FileUploadService } from '../../file-management/file-upload.service';
import { assertUploadAllowed } from '../../shared/utils/upload-validation.util';
import { MAX_IMAGE_BYTES, MAX_REVIEW_IMAGES } from '../review.constants';

export interface StoredReviewImage {
  fileName: string;
  fileUrl: string;
  filePath: string;
  mimeType: string;
  size: number;
}

/** Checks and stores review photos. Images only. */
@Injectable()
export class ReviewFileService {
  constructor(private readonly uploads: FileUploadService) {}

  /** Checks every file first, so nothing is stored when one is bad. */
  validate(files: Express.Multer.File[] | undefined, alreadyHave = 0): Express.Multer.File[] {
    const list = files ?? [];
    if (alreadyHave + list.length > MAX_REVIEW_IMAGES) {
      throw new BadRequestException(`A review can have at most ${MAX_REVIEW_IMAGES} photos`);
    }
    for (const file of list) {
      assertUploadAllowed(file, ['image']);
      if (file.size > MAX_IMAGE_BYTES) {
        throw new BadRequestException(`Photo "${file.originalname}" is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB`);
      }
    }
    return list;
  }

  async store(files: Express.Multer.File[]): Promise<StoredReviewImage[]> {
    const stored: StoredReviewImage[] = [];
    try {
      for (const file of files) {
        const info = await this.uploads.uploadFile(file, 'reviews');
        stored.push({
          fileName: file.originalname.replace(/[\\/]/g, '_').slice(0, 255),
          fileUrl: info.fileUrl,
          filePath: info.filePath,
          mimeType: file.mimetype.slice(0, 150),
          size: file.size,
        });
      }
    } catch (error) {
      await this.discard(stored);
      throw error;
    }
    return stored;
  }

  /** Removes stored files again, when the database write that used them failed or the photo was dropped. */
  async discard(stored: Array<{ filePath: string }>) {
    for (const s of stored) await this.uploads.removeFile(s.filePath).catch(() => undefined);
  }
}
