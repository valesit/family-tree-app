'use client';

import { useEffect } from 'react';
import { useSWRConfig } from 'swr';

const LIVE_KEYS = ['/api/tree', '/api/families', '/api/user/families', '/api/persons', '/api/relationships'];

/**
 * Event-driven collaborative refresh for genealogy data.
 *
 * Do not poll on a timer: even when the tree viewport is preserved, periodic
 * network revalidation makes the application look like it is refreshing.
 * Instead, refresh cached family data when the user returns to the tab/window
 * or reconnects. Local create/update flows continue to mutate/reload their
 * affected data immediately after a successful write.
 */
export function FamilyDataLiveSync() {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    const revalidateFamilyData = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

      void mutate(
        (key) =>
          typeof key === 'string' &&
          LIVE_KEYS.some((prefix) => key.startsWith(prefix)),
        undefined,
        { revalidate: true }
      );
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') revalidateFamilyData();
    };

    window.addEventListener('focus', revalidateFamilyData);
    window.addEventListener('online', revalidateFamilyData);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', revalidateFamilyData);
      window.removeEventListener('online', revalidateFamilyData);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mutate]);

  return null;
}
