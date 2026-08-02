import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AiRateLimit } from '../common/throttler/throttle.decorators';
import { MAX_AUDIO_BYTES, VoiceRecordingPipe } from './coach-audio.validation';
import { CoachService } from './coach.service';
import {
  listPersonalities,
  type CoachConversationView,
  type CoachMessageView,
  type CoachPersonalityView,
  type CoachStreamEvent,
} from './coach.view';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

/**
 * Interval between keep-alive comments on an open stream, milliseconds.
 *
 * The first token can take several seconds, and an idle connection is exactly
 * what a load balancer or mobile network reaps. A comment frame costs nothing
 * and is ignored by every SSE client.
 */
const HEARTBEAT_MS = 15_000;

/**
 * Multer configuration for voice messages.
 *
 * Memory storage: the recording is base64-encoded into one model request and
 * discarded, so it never needs a path on disk — and never writing it down is
 * also the simplest guarantee that nothing a user said is left on the server.
 */
const VOICE_UPLOAD_OPTIONS = { limits: { fileSize: MAX_AUDIO_BYTES, files: 1 } };

/**
 * The AI health coach, mounted at `/api/v1/coach`. Every route is protected by
 * the global auth guard and scoped to the caller's own conversations.
 *
 * The reply route streams. That means it opts out of Nest's normal response
 * handling and writes to the socket itself — the framing below is the whole
 * reason: a status code is chosen before the first token exists, so success and
 * failure both have to be expressible *inside* an already-200 response.
 */
@Controller({ path: 'coach', version: '1' })
export class CoachController {
  constructor(private readonly coach: CoachService) {}

  /** The three coaching voices, for the picker shown when starting a thread. */
  @Get('personalities')
  getPersonalities(): CoachPersonalityView[] {
    return listPersonalities();
  }

  @Post('conversations')
  createConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConversationDto,
  ): Promise<CoachConversationView> {
    return this.coach.createConversation(user.id, dto);
  }

  @Get('conversations')
  listConversations(@CurrentUser() user: AuthenticatedUser): Promise<CoachConversationView[]> {
    return this.coach.listConversations(user.id);
  }

  @Get('conversations/:id/messages')
  listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CoachMessageView[]> {
    return this.coach.listMessages(user.id, id);
  }

  /**
   * Transcribes a spoken question, as `multipart/form-data` with one `audio`
   * part.
   *
   * Returns the words and stops there. Sending is a separate call the user makes
   * after reading what was heard — see {@link CoachService.transcribe} for why
   * the two are not one round trip.
   */
  @Post('voice')
  @AiRateLimit(60)
  @UseInterceptors(FileInterceptor('audio', VOICE_UPLOAD_OPTIONS))
  async transcribe(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(VoiceRecordingPipe) audio: Express.Multer.File,
  ): Promise<{ text: string }> {
    return { text: await this.coach.transcribe(user.id, audio) };
  }

  /**
   * Sends a turn and streams the reply as `text/event-stream`.
   *
   * Failures that happen before the first byte are re-thrown so the global
   * filter renders them as ordinary problem documents — a client asking about a
   * conversation it does not own should get a 404, not a 200 containing an error
   * event. Once the stream is open that route is closed, and failures are
   * delivered as an `error` event instead.
   */
  @Post('conversations/:id/messages')
  @AiRateLimit(120)
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const abort = new AbortController();
    const onClientGone = (): void => {
      if (!response.writableEnded) {
        abort.abort();
      }
    };
    request.on('close', onClientGone);

    let heartbeat: NodeJS.Timeout | undefined;
    let open = false;

    try {
      for await (const event of this.coach.streamReply(user.id, id, dto, abort.signal)) {
        if (!open) {
          this.openStream(response);
          open = true;
          heartbeat = setInterval(() => response.write(': ping\n\n'), HEARTBEAT_MS);
        }
        this.send(response, event);
      }

      // The generator finished without yielding anything, which happens when the
      // client disconnected before the first token. Open and close cleanly so
      // the socket is never left hanging.
      if (!open && !response.writableEnded) {
        this.openStream(response);
      }
    } catch (error) {
      if (!open) {
        throw error;
      }
      this.send(response, {
        type: 'error',
        message: error instanceof Error ? error.message : 'The coach is unavailable.',
      });
    } finally {
      request.off('close', onClientGone);
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      if (!response.writableEnded) {
        response.end();
      }
    }
  }

  // ── stream framing ────────────────────────────────────────────────────────

  /**
   * Opens the event stream.
   *
   * `no-transform` is what stops the compression middleware buffering the
   * response — without it the whole point of streaming is lost, because nothing
   * reaches the client until the answer is complete. `X-Accel-Buffering` says
   * the same thing to a reverse proxy.
   */
  private openStream(response: Response): void {
    response.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    response.flushHeaders();
  }

  /** Writes one named SSE event with a JSON payload. */
  private send(response: Response, event: CoachStreamEvent): void {
    if (response.writableEnded) {
      return;
    }
    response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }
}
