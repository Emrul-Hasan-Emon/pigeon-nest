import { FilesInterceptor } from '@nestjs/platform-express';
import { MAX_ATTACHMENTS } from '../../shared/services/attachment-file.service';

/** Up to 10 files of 10 MB in the multipart field `files`. */
export const ATTACHMENTS = FilesInterceptor('files', MAX_ATTACHMENTS, {
  limits: { fileSize: 10 * 1024 * 1024, files: MAX_ATTACHMENTS },
});
