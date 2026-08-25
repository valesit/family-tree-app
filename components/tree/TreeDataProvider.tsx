'use client';

import { ReactNode } from 'react';
import { SWRConfig } from 'swr';

/**
 * Tree pages deliberately do not poll in the background. Family tree data is
 * expensive to rebuild and polling used to cause visible viewport resets.
 * Fresh data is loaded on navigation and explicit mutations instead.
 */
export function TreeDataProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        refreshInterval: 0,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        keepPreviousData: true,
        dedupingInterval: 30_000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
