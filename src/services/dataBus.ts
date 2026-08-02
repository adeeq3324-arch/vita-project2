/**
 * A minimal publish/subscribe channel for "the user just changed their data".
 *
 * Screens re-read on focus, which covers every write made *on another screen*.
 * It does not cover a write made from the floating action button: that opens a
 * modal over the current screen, so the screen behind it never loses focus and
 * never re-reads — the user logs a glass of water and watches the water tile
 * stay where it was.
 *
 * Rather than reach for a client-side cache library for one case, writes
 * announce what they touched and interested screens re-read. Topics, not one
 * global signal, so logging water does not make the Progress tab refetch a
 * month of analytics.
 */

export type DataTopic =
  /** Food diary entries: meal logs and everything totalled from them. */
  | 'diary'
  /** Daily metrics: water, steps, weight, workout completion. */
  | 'metrics'
  /** Logged training sessions. */
  | 'workouts';

type Listener = () => void;

const listeners = new Map<DataTopic, Set<Listener>>();

/** Subscribes to one topic. Returns the unsubscribe function. */
export function subscribeToData(topic: DataTopic, listener: Listener): () => void {
  const existing = listeners.get(topic) ?? new Set<Listener>();
  existing.add(listener);
  listeners.set(topic, existing);

  return () => {
    existing.delete(listener);
  };
}

/**
 * Announces that `topic` changed. Listeners are copied before iterating so a
 * listener that unsubscribes in response cannot corrupt the walk.
 */
export function emitDataChanged(topic: DataTopic): void {
  const subscribers = listeners.get(topic);
  if (!subscribers) return;
  for (const listener of [...subscribers]) listener();
}
