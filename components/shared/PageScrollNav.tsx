'use client';

import { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Floating mobile-only bubble in the bottom-right that lets the user jump
 * roughly one viewport up or down. Useful on pages where a large interactive
 * area (the family tree canvas) makes single-finger scrolling difficult.
 *
 * Hidden on lg+ screens because desktop users have a scrollbar and wheel.
 *
 * Props let callers tune visibility — the buttons disable themselves when at
 * the corresponding edge of the page so users get clear feedback.
 */
export function PageScrollNav({ className }: { className?: string }) {
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    const update = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setAtTop(y <= 4);
      setAtBottom(max - y <= 4);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  /** Scroll by ~80% of the viewport so context overlaps slightly. */
  const step = () => Math.round(window.innerHeight * 0.8);

  const goUp = () => {
    if (atTop) return;
    window.scrollBy({ top: -step(), behavior: 'smooth' });
  };
  const goDown = () => {
    if (atBottom) return;
    window.scrollBy({ top: step(), behavior: 'smooth' });
  };

  return (
    <div
      className={clsx(
        'fixed bottom-[max(env(safe-area-inset-bottom,0px)+0.75rem,1rem)] right-3 z-40 flex flex-col overflow-hidden rounded-full border border-slate-200 bg-white/95 shadow-[0_10px_25px_-8px_rgba(15,23,42,0.25)] backdrop-blur-sm',
        // Mobile-first: visible on small screens, hidden on lg+ where the wheel/scrollbar suffice.
        'lg:hidden',
        className
      )}
      role="group"
      aria-label="Page navigation"
    >
      <button
        type="button"
        onClick={goUp}
        disabled={atTop}
        aria-label="Scroll up"
        className={clsx(
          'flex h-11 w-11 items-center justify-center transition-colors',
          atTop ? 'cursor-not-allowed text-slate-300' : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'
        )}
      >
        <ChevronUp className="h-5 w-5" aria-hidden />
      </button>
      <div className="h-px w-full bg-slate-200" aria-hidden />
      <button
        type="button"
        onClick={goDown}
        disabled={atBottom}
        aria-label="Scroll down"
        className={clsx(
          'flex h-11 w-11 items-center justify-center transition-colors',
          atBottom ? 'cursor-not-allowed text-slate-300' : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'
        )}
      >
        <ChevronDown className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
