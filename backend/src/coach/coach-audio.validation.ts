import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * What counts as a voice message, and what it is called when it reaches the
 * model.
 *
 * Three platforms record three different things — iOS and Android produce AAC
 * in an MP4 container, a browser produces Opus in WebM — and each labels it with
 * whichever of several historical aliases its runtime prefers. Normalising here
 * means the provider adapter is handed one name per format, and the app does not
 * have to negotiate container support screen by screen.
 */

/** Container aliases mapped to the name the model services recognise. */
const MIME_ALIASES: Record<string, string> = {
  'audio/m4a': 'audio/mp4',
  'audio/x-m4a': 'audio/mp4',
  'audio/mp4a-latm': 'audio/mp4',
  'audio/mpeg': 'audio/mp3',
  'audio/mpga': 'audio/mp3',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/x-aac': 'audio/aac',
  'audio/opus': 'audio/ogg',
  'audio/vorbis': 'audio/ogg',
};

/** Formats accepted, after normalisation. */
export const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/mp4',
  'audio/mp3',
  'audio/wav',
  'audio/aac',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
]);

/**
 * Largest recording accepted, bytes.
 *
 * A cost control before it is a safety one: audio is billed by duration, and a
 * spoken question is seconds long. At the bitrates the recorder is configured
 * for this is several minutes of speech — comfortably past any real question,
 * and far short of somebody uploading an album.
 */
export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

/** Strips any `; codecs=…` parameter and resolves the container's aliases. */
export function normalizeAudioMimeType(mimetype: string): string {
  const base = mimetype.split(';')[0].trim().toLowerCase();
  return MIME_ALIASES[base] ?? base;
}

/** Rejects anything that is not a usable voice recording. */
export function assertValidVoiceRecording(
  file: Express.Multer.File | undefined,
): asserts file is Express.Multer.File {
  if (!file || file.size === 0) {
    throw new BadRequestException('An audio recording is required.');
  }
  if (!ALLOWED_AUDIO_MIME_TYPES.has(normalizeAudioMimeType(file.mimetype))) {
    throw new BadRequestException(
      'Unsupported audio format. Send an M4A, MP3, WAV, AAC, OGG or WebM recording.',
    );
  }
  if (file.size > MAX_AUDIO_BYTES) {
    throw new BadRequestException('That recording is too long. Keep it under 5 MB.');
  }
}

/**
 * Validates an uploaded recording at the request boundary.
 *
 * Mirrors `ScanImagePipe`: `@UploadedFile()` hands the handler `undefined` when
 * the part is missing, and no `ValidationPipe` covers a file, so without this a
 * request with no `audio` part reaches the service as `undefined` and fails as a
 * 500 rather than the 400 it is.
 */
@Injectable()
export class VoiceRecordingPipe implements PipeTransform<Express.Multer.File | undefined> {
  transform(file: Express.Multer.File | undefined): Express.Multer.File {
    assertValidVoiceRecording(file);
    return file;
  }
}
