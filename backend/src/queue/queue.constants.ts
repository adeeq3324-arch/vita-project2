/**
 * The application's background queues and the job names they carry.
 *
 * Names are declared once here rather than as string literals at the producer
 * and the consumer, because a typo in either place is invisible: the job is
 * enqueued successfully and then simply never runs.
 */

export const QUEUE_MEAL_PLAN = 'meal-plan-queue';
export const QUEUE_SUPPLEMENT_PLAN = 'supplement-plan-queue';
export const QUEUE_SCAN = 'scan-queue';
export const QUEUE_REMINDER = 'reminder-queue';
export const QUEUE_PROGRESS = 'progress-queue';

/** Every queue the app registers, for wiring and health reporting. */
export const ALL_QUEUES = [
  QUEUE_MEAL_PLAN,
  QUEUE_SUPPLEMENT_PLAN,
  QUEUE_SCAN,
  QUEUE_REMINDER,
  QUEUE_PROGRESS,
] as const;

/** Job names within {@link QUEUE_MEAL_PLAN}. */
export const JOB_GENERATE_MEAL_PLAN = 'generate-meal-plan';

/** Job names within {@link QUEUE_SUPPLEMENT_PLAN}. */
export const JOB_GENERATE_SUPPLEMENT_PLAN = 'generate-supplement-plan';
/** The repeatable monthly sweep that re-triggers generation for active users. */
export const JOB_MONTHLY_SUPPLEMENT_SWEEP = 'monthly-supplement-sweep';

/** Job names within {@link QUEUE_SCAN}. */
export const JOB_ANALYSE_FOOD_SCAN = 'analyse-food-scan';
export const JOB_ANALYSE_QUALITY_SCAN = 'analyse-quality-scan';
export const JOB_ANALYSE_BARCODE_SCAN = 'analyse-barcode-scan';

/** Job names within {@link QUEUE_REMINDER}. */
/** The repeatable minute-by-minute sweep that claims and fans out due reminders. */
export const JOB_REMINDER_SWEEP = 'reminder-sweep';
/** One claimed reminder, to be delivered. */
export const JOB_DELIVER_REMINDER = 'deliver-reminder';

/** Job names within {@link QUEUE_PROGRESS}. */
/** The repeatable Monday roll-up of the week that has just finished. */
export const JOB_WEEKLY_SNAPSHOT_SWEEP = 'weekly-snapshot-sweep';
/** The repeatable first-of-the-month roll-up of the month that has just finished. */
export const JOB_MONTHLY_SNAPSHOT_SWEEP = 'monthly-snapshot-sweep';

/**
 * Payload every generation job carries.
 *
 * The job holds ids only, never the data itself: the worker re-reads the
 * profile, goal and targets when it starts, so a job that sat in the queue for a
 * while is generated against the user's current state rather than a stale copy
 * captured at enqueue time.
 */
export interface GenerationJobData {
  /** The `ai_jobs` row tracking this unit of work. */
  aiJobId: string;
  userId: string;
  /** The domain row to fill in (a meal plan, a supplement plan). */
  targetId: string;
}

/**
 * Payload for a deferred scan.
 *
 * Scans differ from the plan jobs in that no domain row exists yet — a
 * `scan_results` row is only written once there is a result to put in it. The
 * job therefore carries the *input* (a stored image path, or a barcode) rather
 * than the id of a row to fill in, and the `ai_jobs` entry is what the client
 * polls until a `resultRefId` appears on it.
 */
export interface ScanJobData {
  aiJobId: string;
  userId: string;
  scanType: 'food' | 'colorQuality' | 'barcode';
  /** Storage object path of the uploaded photo. Set for the two photo scanners. */
  imagePath?: string;
  /** The scanned code. Set for barcode scans. */
  barcode?: string;
}

/**
 * Payload for delivering one reminder.
 *
 * Carries ids only, like every other job here: the worker re-reads the reminder, so
 * a nudge that waited briefly in the queue is delivered with the name the user has
 * *now* rather than the one captured when it was claimed. The claim itself — which
 * is what stops two instances sending the same reminder — has already happened in
 * the database before this job exists.
 */
export interface ReminderJobData {
  reminderId: string;
  userId: string;
  /** The firing this job represents, ISO-8601. Logged so a late send is visible. */
  dueAt: string;
}
