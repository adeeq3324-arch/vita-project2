import { BadRequestException } from '@nestjs/common';
import { ScanImagePipe } from './scan-image.pipe';
import { assertValidScanImage, MAX_UPLOAD_BYTES } from './scan-image.validation';

/** A plausible upload; individual tests override the field under examination. */
const buildFile = (): Express.Multer.File =>
  ({
    fieldname: 'image',
    originalname: 'meal.jpg',
    mimetype: 'image/jpeg',
    size: 2048,
    buffer: Buffer.alloc(2048),
  }) as Express.Multer.File;

const fileWith = (overrides: Partial<Express.Multer.File>): Express.Multer.File =>
  ({ ...buildFile(), ...overrides }) as Express.Multer.File;

describe('assertValidScanImage', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])(
    'accepts %s, which a phone camera actually produces',
    (mimetype) => {
      expect(() => assertValidScanImage(fileWith({ mimetype }))).not.toThrow();
    },
  );

  /**
   * The case that motivates validating at the boundary at all: Multer hands the
   * handler `undefined` when the part is missing, and an unguarded `undefined`
   * becomes a 500 somewhere further down instead of a 400 here.
   */
  it('rejects a missing file', () => {
    expect(() => assertValidScanImage(undefined)).toThrow(BadRequestException);
    expect(() => assertValidScanImage(undefined)).toThrow('An image file is required.');
  });

  it('rejects an empty file', () => {
    expect(() => assertValidScanImage(fileWith({ size: 0 }))).toThrow(
      'An image file is required.',
    );
  });

  it.each(['application/pdf', 'text/html', 'image/gif', 'application/octet-stream'])(
    'rejects %s',
    (mimetype) => {
      expect(() => assertValidScanImage(fileWith({ mimetype }))).toThrow(
        /Unsupported image format/,
      );
    },
  );

  it('accepts a file exactly at the size ceiling', () => {
    expect(() => assertValidScanImage(fileWith({ size: MAX_UPLOAD_BYTES }))).not.toThrow();
  });

  it('rejects a file one byte over the ceiling', () => {
    expect(() => assertValidScanImage(fileWith({ size: MAX_UPLOAD_BYTES + 1 }))).toThrow(
      /too large/,
    );
  });
});

describe('ScanImagePipe', () => {
  const pipe = new ScanImagePipe();

  it('returns a valid file unchanged', () => {
    const file = buildFile();
    expect(pipe.transform(file)).toBe(file);
  });

  /**
   * The pipe and the storage service must reject identically — the whole reason
   * the rule lives in one shared assertion. A caller should never get two
   * different messages for the same bad upload depending on which layer caught
   * it first.
   */
  it('rejects exactly what the storage layer rejects, with the same wording', () => {
    const cases: Array<Express.Multer.File | undefined> = [
      undefined,
      fileWith({ size: 0 }),
      fileWith({ mimetype: 'application/pdf' }),
      fileWith({ size: MAX_UPLOAD_BYTES + 1 }),
    ];

    for (const file of cases) {
      let fromPipe: string | undefined;
      let fromAssertion: string | undefined;

      try {
        pipe.transform(file);
      } catch (error) {
        fromPipe = (error as Error).message;
      }
      try {
        assertValidScanImage(file);
      } catch (error) {
        fromAssertion = (error as Error).message;
      }

      expect(fromPipe).toBeDefined();
      expect(fromPipe).toBe(fromAssertion);
    }
  });
});
