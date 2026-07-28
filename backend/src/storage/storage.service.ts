import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN_CLIENT } from '../supabase/supabase.constants';
import { assertValidScanImage, EXTENSIONS } from './scan-image.validation';

export { MAX_UPLOAD_BYTES } from './scan-image.validation';

/** How long a signed read URL stays valid, seconds. */
const SIGNED_URL_TTL = 60 * 60;

/**
 * Scan images in Supabase Storage.
 *
 * The bucket is treated as **private**. Uploads are written under a per-user
 * prefix and every read goes through a short-lived signed URL — including the
 * one handed to the model — so a photograph of somebody's meal is never
 * reachable by guessing a path, and a URL that leaks stops working within the
 * hour.
 *
 * `scan_results.image_url` therefore stores the object *path*, not a URL: a URL
 * would be stale the moment it was written.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket: string;

  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT) private readonly supabase: SupabaseClient,
    config: ConfigService,
  ) {
    this.bucket = config.get<string>('supabase.scansBucket', 'scans');
  }

  /**
   * Stores an uploaded scan photo and returns its object path.
   *
   * The path is namespaced by user so bucket-level policies can be written
   * against the prefix, and randomised so one upload can never overwrite
   * another.
   */
  async uploadScanImage(userId: string, file: Express.Multer.File): Promise<string> {
    // Re-checked here even though the controller's pipe has already run: this
    // method is also reached from the queue worker, where no pipe exists.
    assertValidScanImage(file);

    const extension = EXTENSIONS[file.mimetype] ?? 'jpg';
    const path = `${userId}/${randomUUID()}.${extension}`;

    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        // Never overwrite: the path is unique, so a collision would mean
        // something is badly wrong and should fail loudly rather than clobber.
        upsert: false,
      });

    if (error) {
      this.logger.error(`Scan image upload failed for ${userId}: ${error.message}`);
      throw new InternalServerErrorException('The image could not be stored. Please try again.');
    }

    return path;
  }

  /**
   * A short-lived read URL for a stored object.
   *
   * Used both to hand the image to the model and to return it to the client, so
   * neither ever needs standing access to the bucket.
   */
  async createSignedUrl(path: string, expiresIn: number = SIGNED_URL_TTL): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresIn);

    if (error || !data?.signedUrl) {
      this.logger.error(`Could not sign "${path}": ${error?.message ?? 'no URL returned'}`);
      throw new InternalServerErrorException('The image could not be read. Please try again.');
    }

    return data.signedUrl;
  }

  /**
   * Deletes a stored object, best-effort.
   *
   * Called when an analysis fails after the upload succeeded. A failure to clean
   * up is logged rather than raised: the user's request already failed, and
   * turning a leftover file into a second error helps nobody.
   */
  async remove(path: string): Promise<void> {
    const { error } = await this.supabase.storage.from(this.bucket).remove([path]);
    if (error) {
      this.logger.warn(`Could not remove orphaned scan image "${path}": ${error.message}`);
    }
  }
}
