import { BadRequestException } from '@nestjs/common';

export type MediaKind = 'image' | 'video';

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'avif',
  'heic',
  'heif',
]);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov']);

const EXTENSIONS: Record<MediaKind, Set<string>> = {
  image: IMAGE_EXTENSIONS,
  video: VIDEO_EXTENSIONS,
};

// Magic-byte check so a renamed script/text file cannot pass as media.
function matchesSignature(buffer: Buffer, kind: MediaKind): boolean {
  const ascii = (start: number, end: number) =>
    buffer.subarray(start, end).toString('latin1');
  const startsWith = (...bytes: number[]) =>
    bytes.every((byte, index) => buffer[index] === byte);

  if (kind === 'image') {
    return (
      startsWith(0xff, 0xd8, 0xff) ||
      startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) ||
      ['GIF87a', 'GIF89a'].includes(ascii(0, 6)) ||
      (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') ||
      (ascii(4, 8) === 'ftyp' &&
        [
          'avif',
          'avis',
          'heic',
          'heix',
          'hevc',
          'hevx',
          'heim',
          'heis',
          'mif1',
          'msf1',
        ].includes(ascii(8, 12)))
    );
  }
  return (
    startsWith(0x1a, 0x45, 0xdf, 0xa3) ||
    ['ftyp', 'moov', 'mdat', 'free', 'wide', 'skip'].includes(ascii(4, 8))
  );
}

// Throws 400 unless the file is non-empty, has an allowed extension AND MIME
// type for one of `kinds`, and its leading bytes match that format.
export function assertUploadAllowed(
  file: Express.Multer.File,
  kinds: MediaKind[],
) {
  if (!file.size) {
    throw new BadRequestException(`File "${file.originalname}" is empty`);
  }
  const extension = file.originalname.split('.').pop()?.toLowerCase() ?? '';
  const allowed = kinds.some(
    (kind) =>
      file.mimetype.startsWith(`${kind}/`) && EXTENSIONS[kind].has(extension),
  );
  if (!allowed) {
    throw new BadRequestException(
      `File "${file.originalname}" must be ${kinds.join(' or ')} (${kinds
        .map((kind) => [...EXTENSIONS[kind]].join(', '))
        .join(', ')})`,
    );
  }
  if (
    file.buffer &&
    !kinds.some((kind) => matchesSignature(file.buffer, kind))
  ) {
    throw new BadRequestException(
      `File "${file.originalname}" content does not match a supported ${kinds.join(' or ')} format`,
    );
  }
}
