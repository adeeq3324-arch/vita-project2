import { Injectable, PipeTransform } from '@nestjs/common';
import { assertValidScanImage } from './scan-image.validation';

/**
 * Validates an uploaded scan photo at the request boundary.
 *
 * Nest's `@UploadedFile()` hands the handler whatever Multer produced —
 * including `undefined` when the part is missing entirely — and no global
 * `ValidationPipe` covers it, because a file is not a DTO. Without an explicit
 * pipe, a request with no `image` part reaches the service layer as
 * `undefined`, which is exactly the shape that turns a client mistake into a
 * 500 somewhere further down.
 *
 * Deliberately not Nest's built-in `ParseFilePipe`: its `FileTypeValidator` and
 * `MaxFileSizeValidator` produce their own generic wording, which would give the
 * same rejection two different messages depending on which layer caught it.
 * Delegating to the shared assertion keeps one rule and one message.
 */
@Injectable()
export class ScanImagePipe implements PipeTransform<Express.Multer.File | undefined> {
  transform(file: Express.Multer.File | undefined): Express.Multer.File {
    assertValidScanImage(file);
    return file;
  }
}
