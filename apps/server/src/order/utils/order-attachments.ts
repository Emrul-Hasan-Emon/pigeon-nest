import { FilesInterceptor } from '@nestjs/platform-express';
import { MAX_ATTACHMENTS } from '../../shared/services/attachment-file.service';

/** The `files` field of an order, payment, update or refund request: up to MAX_ATTACHMENTS files, 10 MB each. */
export const ATTACHMENTS = FilesInterceptor('files', MAX_ATTACHMENTS, {
  limits: { fileSize: 10 * 1024 * 1024, files: MAX_ATTACHMENTS },
});
