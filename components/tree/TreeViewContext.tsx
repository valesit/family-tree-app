'use client';

import { createContext, useCallback, useContext, useRef } from 'react';

type TreeViewContextValue = {
  /** Call from node click handler; returns true if click should be skipped (after pan). */
  consumeIfSuppressClick: () => boolean;
  /** Internal: mark that a pan gesture just ended so the next click is ignored. */
  markPanEnded: () => void;
};

const TreeViewContext = createContext<TreeViewContextValue | null>(null);

export function TreeViewProvider({ children }: { children: React.ReactNode }) {
  const suppressNextClickRef = useRef(false);

  const markPanEnded = useCallback(() => {
    suppressNextClickRef.current = true;
  }, []);

  const consumeIfSuppressClick = useCallback(() => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return true;
    }
    return false;
  }, []);

  return (
    <TreeViewContext.Provider value={{ consumeIfSuppressClick, markPanEnded }}>
      {children}
    </TreeViewContext.Provider>
  );
}

export function useTreeViewOptional() {
  return useContext(TreeViewContext);
}
