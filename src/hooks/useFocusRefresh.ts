import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef } from 'react';

/**
 * Re-reads a resource whenever the screen is focused again.
 *
 * The app writes from one screen and reads from another — a meal logged in Add
 * Meal changes the Home dashboard, a saved profile changes the targets Progress
 * measures against. Without this, returning to a tab shows the numbers as they
 * were when it last mounted, which reads as the app losing the write.
 *
 * The first focus is skipped: the resource's own initial load already covers it,
 * and refetching there would double every screen's opening request.
 */
export function useFocusRefresh(refresh: () => void | Promise<void>): void {
  const skipNext = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (skipNext.current) {
        skipNext.current = false;
        return;
      }
      void refresh();
    }, [refresh]),
  );
}
