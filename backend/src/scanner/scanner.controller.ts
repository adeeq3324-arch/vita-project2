import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AiRateLimit } from '../common/throttler/throttle.decorators';
import { ScanImagePipe } from '../storage/scan-image.pipe';
import { MAX_UPLOAD_BYTES } from '../storage/storage.service';
import { ScanBarcodeDto } from './dto/scan-barcode.dto';
import { ScannerService } from './scanner.service';
import type {
  BarcodeOutcomeView,
  ScanJobView,
  ScanOutcomeView,
  ScanResultView,
} from './scan.view';

/**
 * Multer configuration for the photo scanners.
 *
 * Memory storage on purpose: the file is forwarded straight to object storage
 * and never needs a path on disk, so writing it to the container's filesystem
 * would only add a temp file to clean up. The size limit is enforced here as
 * well as in the storage service, so an oversized upload is rejected while it is
 * still arriving rather than after it has all been buffered.
 */
const UPLOAD_OPTIONS = { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } };

/**
 * The three scanners, mounted at `/api/v1/scanner`. Every route is protected by
 * the global auth guard and scoped to the caller's own scans.
 *
 * The photo routes accept `multipart/form-data` with a single `image` part.
 * Each returns either the finished analysis or a job id to poll, so a client
 * must branch on `status` rather than assuming a result is present.
 */
@Controller({ path: 'scanner', version: '1' })
export class ScannerController {
  constructor(private readonly scanner: ScannerService) {}

  /** Identifies a food from a photograph and scores it for the caller. */
  @Post('food')
  @AiRateLimit(30)
  @UseInterceptors(FileInterceptor('image', UPLOAD_OPTIONS))
  scanFood(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(ScanImagePipe) image: Express.Multer.File,
  ): Promise<ScanOutcomeView> {
    return this.scanner.scanFood(user.id, image);
  }

  /** Judges freshness and quality from a photograph. */
  @Post('quality')
  @AiRateLimit(30)
  @UseInterceptors(FileInterceptor('image', UPLOAD_OPTIONS))
  scanQuality(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(ScanImagePipe) image: Express.Multer.File,
  ): Promise<ScanOutcomeView> {
    return this.scanner.scanQuality(user.id, image);
  }

  /** Resolves a packaged product and gives the caller a verdict on it. */
  @Post('barcode')
  @AiRateLimit(60)
  scanBarcode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ScanBarcodeDto,
  ): Promise<BarcodeOutcomeView> {
    return this.scanner.scanBarcode(user.id, dto.barcode);
  }

  /** Poll target for a scan that was handed to the queue. */
  @Get('jobs/:id')
  getJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ScanJobView> {
    return this.scanner.getJob(user.id, id);
  }

  /** A stored scan result, with a freshly signed image URL. */
  @Get('scans/:id')
  getScan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ScanResultView> {
    return this.scanner.getScan(user.id, id);
  }
}
