import { useEffect, useRef } from 'react';

import { subscribeToData, type DataTopic } from '@/services/dataBus';

/**
 * Re-reads a resource when one of `topics` is written from anywhere in the app.
 *
 * Pairs with `useFocusRefresh`: that covers writes made on a different screen,
 * this covers writes made from a modal over the current one (the FAB's quick
 * actions), where focus never changes.
 */
export function useDataChanged(topics: DataTopic[], refresh: () => void | Promise<void>): void {
  // The handler is an inline closure at every call site; holding the latest in
  // a ref keeps the subscription tied to the topics alone, so it is not torn
  // down and rebuilt on every render.
  const handler = useRef(refresh);
  useEffect(() => {
    handler.current = refresh;
  });

  const key = topics.join(' ');

  useEffect(() => {
    const unsubscribes = key
      .split(' ')
      .filter(Boolean)
      .map((topic) => subscribeToData(topic as DataTopic, () => void handler.current()));

    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [key]);
}
