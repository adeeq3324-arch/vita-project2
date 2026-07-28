import { BadRequestException } from '@nestjs/common';

/** Image formats a phone camera or gallery realistically produces. */
export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]);

/** Extension used when a MIME type is not one we have a mapping for. */
export const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

/** Largest upload accepted, bytes. Comfortably above a full-resolution photo. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Rejects anything that is not a usable scan photo.
 *
 * Lives on its own so the boundary and the storage layer enforce the *same*
 * rule with the *same* wording. The controller applies it first, which is where
 * a bad upload should die — before a user-context lookup and a bucket write are
 * spent on a request that was never going to succeed. The storage service
 * applies it again because it is also reached from the queue worker, where no
 * controller has run.
 *
 * Duplicated enforcement, single definition: the two can never drift into
 * disagreeing about what a valid image is.
 */
export function assertValidScanImage(
  file: Express.Multer.File | undefined,
): asserts file is Express.Multer.File {
  if (!file || file.size === 0) {
    throw new BadRequestException('An image file is required.');
  }
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new BadRequestException(
      'Unsupported image format. Send a JPEG, PNG, WebP or HEIC photo.',
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new BadRequestException('That image is too large. Keep it under 10 MB.');
  }
}
