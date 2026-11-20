import { BadRequestException } from '@nestjs/common';
import { assertUploadAllowed } from './upload-validation.util';

export type AttachmentKind = 'image' | 'file';

// Documents a seller, admin or customer may attach, with the MIME types a
// browser sends for them. Anything else (scripts, archives, executables) is refused.
const DOCUMENTS: Record<string, string[]> = {
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  txt: ['text/plain'],
  csv: ['text/csv', 'application/csv', 'text/plain'],
};

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i;

function startsWith(buffer: Buffer, ...bytes: number[]) {
  return bytes.every((b, i) => buffer[i] === b);
}

function documentMatches(ext: string, buffer: Buffer): boolean {
  switch (ext) {
    case 'pdf':
      return buffer.subarray(0, 5).toString('latin1') === '%PDF-';
    case 'doc':
    case 'xls':
      return startsWith(buffer, 0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    case 'docx':
    case 'xlsx':
      return startsWith(buffer, 0x50, 0x4b, 0x03, 0x04);
    default: // txt, csv: text only, so no NUL bytes near the start
      return !buffer.subarray(0, 1024).includes(0);
  }
}

/** Throws 400 unless the file is an image or one of the allowed documents; says which. */
export function assertAttachmentAllowed(file: Express.Multer.File): AttachmentKind {
  if (IMAGE_EXT.test(file.originalname) && file.mimetype.startsWith('image/')) {
    assertUploadAllowed(file, ['image']);
    return 'image';
  }
  if (!file.size) throw new BadRequestException(`File "${file.originalname}" is empty`);
  const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
  const mimes = DOCUMENTS[ext];
  if (!mimes || !mimes.includes(file.mimetype)) {
    throw new BadRequestException(
      `File "${file.originalname}" must be an image or one of: ${Object.keys(DOCUMENTS).join(', ')}`,
    );
  }
  if (file.buffer && !documentMatches(ext, file.buffer)) {
    throw new BadRequestException(`File "${file.originalname}" content does not match its type`);
  }
  return 'file';
}
