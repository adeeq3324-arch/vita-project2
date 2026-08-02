import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { AI_SERVICE } from '../ai/ai.constants';
import { AiService, type AiMessage } from '../ai/ai.interface';
import { UserContextService, type UserContext } from '../ai-context/user-context.service';
import { resolveTimeZone, startOfMonth, startOfWeek, todayIn } from '../common/util/date.util';
import { DRIZZLE, type Database } from '../database/database.constants';
import {
  coachConversations,
  coachMessages,
  mealPlans,
  supplementPlans,
  type CoachConversation,
  type CoachMessage,
} from '../database/schema';
import { normalizeAudioMimeType } from './coach-audio.validation';
import {
  buildCoachSystemPrompt,
  deriveTitle,
  type CoachPlanAwareness,
} from './coach.personality';
import {
  toCoachConversationView,
  toCoachMessageView,
  type CoachConversationView,
  type CoachMessageView,
  type CoachStreamEvent,
} from './coach.view';
import type { CreateConversationDto } from './dto/create-conversation.dto';
import type { SendMessageDto } from './dto/send-message.dto';

/**
 * Turns replayed to the model on each request.
 *
 * The whole thread is not sent: cost grows with the square of a conversation's
 * length if it is, and a coach rarely needs more than the recent exchange to
 * answer well. The system prompt carries the user's actual profile, so the
 * durable facts survive the window falling off the end.
 */
const HISTORY_WINDOW = 20;

/** Room for a chat answer. Short by design — see the format rules in the prompt. */
const REPLY_MAX_TOKENS = 1024;

/**
 * The AI health coach.
 *
 * Conversations are ordinary owned rows; the interesting part is the reply path,
 * which streams. The service exposes that as an async generator of typed events
 * and leaves the HTTP framing to the controller, so the transport could change
 * without touching how a reply is produced or stored.
 */
@Injectable()
export class CoachService {
  private readonly logger = new Logger(CoachService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(AI_SERVICE) private readonly ai: AiService,
    private readonly userContext: UserContextService,
  ) {}

  async createConversation(
    userId: string,
    dto: CreateConversationDto,
  ): Promise<CoachConversationView> {
    const [conversation] = await this.db
      .insert(coachConversations)
      .values({
        userId,
        personality: dto.personality ?? 'motivator',
        // Left at the column default when unset; replaced by the opening
        // question's text once the first message arrives.
        ...(dto.title ? { title: dto.title } : {}),
      })
      .returning();

    return toCoachConversationView(conversation);
  }

  /** The caller's threads, most recently active first. */
  async listConversations(userId: string): Promise<CoachConversationView[]> {
    const rows = await this.db.query.coachConversations.findMany({
      where: eq(coachConversations.userId, userId),
      orderBy: [desc(coachConversations.updatedAt)],
    });

    return rows.map(toCoachConversationView);
  }

  /** Full history of one thread, oldest first. */
  async listMessages(userId: string, conversationId: string): Promise<CoachMessageView[]> {
    await this.findOwnedConversation(userId, conversationId);

    const rows = await this.db.query.coachMessages.findMany({
      where: eq(coachMessages.conversationId, conversationId),
      orderBy: [asc(coachMessages.createdAt)],
    });

    return rows.map(toCoachMessageView);
  }

  /**
   * Persists the user's turn, then streams the coach's reply.
   *
   * The user's message is committed before generation starts, so a failed or
   * abandoned reply still leaves the question in the thread — the user can
   * simply ask again rather than retyping.
   *
   * The assistant's turn is written only when the stream completes naturally. A
   * client that disconnects mid-answer leaves no half-finished reply in the
   * history, which would otherwise be indistinguishable from the coach having
   * stopped mid-sentence.
   */
  async *streamReply(
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
    signal: AbortSignal,
  ): AsyncGenerator<CoachStreamEvent> {
    const conversation = await this.findOwnedConversation(userId, conversationId);
    const context = await this.userContext.build(userId);
    const plans = await this.planAwareness(userId, context);

    await this.appendMessage(conversationId, 'user', dto.content);
    await this.titleIfUnnamed(conversation, dto.content);

    const history = await this.recentTurns(conversationId);
    const system = buildCoachSystemPrompt(conversation.personality, context, plans);

    let answer = '';
    try {
      for await (const chunk of this.ai.chat(history, {
        system,
        temperature: 0.7,
        maxOutputTokens: REPLY_MAX_TOKENS,
        signal,
      })) {
        answer += chunk;
        yield { type: 'chunk', text: chunk };
      }
    } catch (error) {
      // An abort is the client leaving, not a fault: there is nobody left to
      // send an error to, and nothing should be written.
      if (signal.aborted) {
        this.logger.log(`Coach stream for ${conversationId} cancelled by the client`);
        return;
      }

      const message = error instanceof Error ? error.message : 'The coach is unavailable.';
      this.logger.error(`Coach stream for ${conversationId} failed: ${message}`);
      yield { type: 'error', message };
      return;
    }

    if (signal.aborted) {
      return;
    }

    if (answer.trim().length === 0) {
      yield { type: 'error', message: 'The coach did not return an answer. Please try again.' };
      return;
    }

    const saved = await this.appendMessage(conversationId, 'assistant', answer.trim());
    await this.touch(conversationId);

    yield { type: 'done', messageId: saved.id, content: saved.content };
  }

  /**
   * Turns a spoken message into the text of a turn, without sending it.
   *
   * Transcription is deliberately its own step rather than a mode of
   * {@link streamReply}: the user has to see what was heard before it is
   * committed to the thread. Speech recognition mishears names, numbers and
   * anything said in a second language, and a wrong word silently sent as a
   * question produces a confident answer to something nobody asked. Returning
   * the text lets the client put it in the composer, where it can be corrected.
   */
  async transcribe(userId: string, audio: Express.Multer.File): Promise<string> {
    const text = await this.ai.transcribeAudio({
      mediaType: normalizeAudioMimeType(audio.mimetype),
      base64: audio.buffer.toString('base64'),
    });

    if (text.length === 0) {
      this.logger.log(`Voice message from ${userId} carried no speech`);
      throw new BadRequestException(
        "I couldn't hear anything in that recording. Try again, a little closer to the microphone.",
      );
    }

    return text;
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /**
   * Whether the Planning tab already holds a plan for the period the user is in.
   *
   * Read here rather than through the planning services because the coach only
   * needs to know *that* a plan exists, and importing either module for a
   * boolean would tie the coach's startup to the queues and schedulers behind
   * plan generation — for a fact that is one indexed row lookup.
   *
   * A failure is answered "no plan", not propagated: the plans are context for
   * the prompt, and a coach that refuses to answer because a status lookup
   * failed would be worse than one that phrases its handover slightly wrong.
   */
  private async planAwareness(
    userId: string,
    context: UserContext,
  ): Promise<CoachPlanAwareness> {
    const today = todayIn(resolveTimeZone(context.timezone));

    try {
      const [meal, supplement] = await Promise.all([
        this.db.query.mealPlans.findFirst({
          columns: { status: true },
          where: and(
            eq(mealPlans.userId, userId),
            eq(mealPlans.weekStartDate, startOfWeek(today)),
          ),
        }),
        this.db.query.supplementPlans.findFirst({
          columns: { status: true },
          where: and(
            eq(supplementPlans.userId, userId),
            eq(supplementPlans.monthStartDate, startOfMonth(today)),
          ),
        }),
      ]);

      return {
        hasMealPlan: meal?.status === 'ready',
        hasSupplementPlan: supplement?.status === 'ready',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Could not read plan status for ${userId}: ${message}`);
      return { hasMealPlan: false, hasSupplementPlan: false };
    }
  }

  private async findOwnedConversation(
    userId: string,
    conversationId: string,
  ): Promise<CoachConversation> {
    const conversation = await this.db.query.coachConversations.findFirst({
      where: and(
        eq(coachConversations.id, conversationId),
        eq(coachConversations.userId, userId),
      ),
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }
    return conversation;
  }

  private async appendMessage(
    conversationId: string,
    role: CoachMessage['role'],
    content: string,
  ): Promise<CoachMessage> {
    const [message] = await this.db
      .insert(coachMessages)
      .values({ conversationId, role, content })
      .returning();

    return message;
  }

  /** Names a thread after its opening question, if it is still unnamed. */
  private async titleIfUnnamed(
    conversation: CoachConversation,
    firstMessage: string,
  ): Promise<void> {
    if (conversation.title !== 'New conversation') {
      return;
    }

    await this.db
      .update(coachConversations)
      .set({ title: deriveTitle(firstMessage), updatedAt: new Date() })
      .where(eq(coachConversations.id, conversation.id));
  }

  private async touch(conversationId: string): Promise<void> {
    await this.db
      .update(coachConversations)
      .set({ updatedAt: new Date() })
      .where(eq(coachConversations.id, conversationId));
  }

  /**
   * The tail of the conversation, oldest first.
   *
   * Fetched newest-first so the window is taken from the *recent* end, then
   * reversed back into reading order for the model.
   */
  private async recentTurns(conversationId: string): Promise<AiMessage[]> {
    const rows = await this.db.query.coachMessages.findMany({
      where: eq(coachMessages.conversationId, conversationId),
      orderBy: [desc(coachMessages.createdAt)],
      limit: HISTORY_WINDOW,
    });

    return rows
      .reverse()
      .map((row) => ({ role: row.role, content: row.content }) satisfies AiMessage);
  }
}
