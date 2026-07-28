/**
 * The delivery contract between the features that want to notify a user and the
 * transport that actually does it.
 *
 * Deliberately transport-agnostic: nothing here mentions Expo, so replacing the
 * sender with APNs/FCM directly, or fanning out to a second channel, is a change
 * to one provider rather than to every caller.
 */

/** A notification to deliver to every device a user has registered. */
export interface PushMessage {
  title: string;
  body: string;
  /** Small opaque payload the app reads when the notification is opened. */
  data?: Record<string, string>;
  /** Notification channel id on Android; ignored elsewhere. */
  channelId?: string;
}

/** What a delivery attempt achieved, per user. */
export interface PushResult {
  /** Devices the push was accepted for. */
  delivered: number;
  /** Devices the transport rejected but which may work later (network, 5xx). */
  failed: number;
  /** Tokens the transport reported as permanently gone; these were revoked. */
  revoked: number;
  /** True when nothing was attempted (push disabled, or no registered device). */
  skipped: boolean;
}

export const EMPTY_PUSH_RESULT: PushResult = {
  delivered: 0,
  failed: 0,
  revoked: 0,
  skipped: true,
};
