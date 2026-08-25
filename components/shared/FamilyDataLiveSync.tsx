'use client';

import { useEffect } from 'react';
import { useSWRConfig } from 'swr';

const LIVE_KEYS = ['/api/tree', '/api/families', '/api/user/families', '/api/persons', '/api/relationships'];

/**
 * Lightweight collaborative refresh for genealogy data.
 *
 * Family trees change relatively infrequently, so a short SWR revalidation
 * interval gives users near-real-time updates without the complexity of a
 * websocket service. Only keys that are already present in the current tab's
 * SWR cache are revalidated.
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

    const interval = window.setInterval(revalidateFamilyData, 3000);
    window.addEventListener('focus', revalidateFamilyData);
    window.addEventListener('online', revalidateFamilyData);
    document.addEventListener('visibilitychange', revalidateFamilyData);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', revalidateFamilyData);
      window.removeEventListener('online', revalidateFamilyData);
      document.removeEventListener('visibilitychange', revalidateFamilyData);
    };
  }, [mutate]);

  return null;
}
