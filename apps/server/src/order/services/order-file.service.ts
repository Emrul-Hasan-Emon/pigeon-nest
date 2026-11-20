import { BadRequestException, Injectable } from '@nestjs/common';
import { FileUploadService } from '../../file-management/file-upload.service';
import { assertAttachmentAllowed, AttachmentKind } from '../../shared/utils/attachment-validation.util';

export const MAX_ATTACHMENTS = 10;

export interface StoredAttachment {
  kind: AttachmentKind;
  fileName: string;
  fileUrl: string;
  filePath: string;
  mimeType: string;
  size: number;
}

/** Validates and stores the files that come with a payment or an order update. */
@Injectable()
export class OrderFileService {
  constructor(private readonly uploads: FileUploadService) {}

  /** Checks every file first, so nothing is stored when one is bad. */
  validate(files: Express.Multer.File[] | undefined): Express.Multer.File[] {
    const list = files ?? [];
    if (list.length > MAX_ATTACHMENTS) {
      throw new BadRequestException(`At most ${MAX_ATTACHMENTS} files can be attached`);
    }
    for (const file of list) assertAttachmentAllowed(file);
    return list;
  }

  async store(files: Express.Multer.File[], folder: string): Promise<StoredAttachment[]> {
    const stored: StoredAttachment[] = [];
    try {
      for (const file of files) {
        const kind = assertAttachmentAllowed(file);
        const info = await this.uploads.uploadFile(file, folder);
        stored.push({
          kind,
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

  /** Remove stored files again, when the database write that used them failed. */
  async discard(stored: StoredAttachment[]) {
    for (const s of stored) await this.uploads.removeFile(s.filePath).catch(() => undefined);
  }
}
