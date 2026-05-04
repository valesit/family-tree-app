'use client';

import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';
import { clsx } from 'clsx';

interface TreeControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  /** Optional explicit "fit to screen" handler; falls back to onReset if absent. */
  onFit?: () => void;
  scale: number;
}

/**
 * Floating zoom & fit controls. Buttons are sized for thumbs (≥44 px) on
 * touch devices and labelled for screen readers — single-icon buttons in
 * the original version triggered "Buttons must have discernible text".
 */
export function TreeControls({ onZoomIn, onZoomOut, onReset, onFit, scale }: TreeControlsProps) {
  const zoomPercentage = Math.round(scale * 100);
  const fitHandler = onFit ?? onReset;

  return (
    <div
      className="absolute right-2 top-2 z-10 flex flex-col items-center gap-2 sm:right-4 sm:top-4"
      data-tree-controls
      role="toolbar"
      aria-label="Tree zoom controls"
    >
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur-sm">
        <ControlButton
          onClick={onZoomIn}
          disabled={scale >= 2}
          ariaLabel="Zoom in"
          title="Zoom in"
        >
          <ZoomIn className="h-5 w-5" aria-hidden />
        </ControlButton>

        <div className="px-1 py-0.5 text-center" aria-live="polite">
          <span className="text-[11px] font-medium tabular-nums text-slate-500">
            {zoomPercentage}%
          </span>
        </div>

        <ControlButton
          onClick={onZoomOut}
          disabled={scale <= 0.25}
          ariaLabel="Zoom out"
          title="Zoom out"
        >
          <ZoomOut className="h-5 w-5" aria-hidden />
        </ControlButton>

        <div className="my-1 h-px w-full bg-slate-200" aria-hidden />

        <ControlButton onClick={fitHandler} ariaLabel="Fit tree to screen" title="Fit to screen">
          <Maximize2 className="h-5 w-5" aria-hidden />
        </ControlButton>

        <ControlButton onClick={onReset} ariaLabel="Reset view" title="Reset view">
          <RotateCcw className="h-5 w-5" aria-hidden />
        </ControlButton>
      </div>
    </div>
  );
}

interface ControlButtonProps {
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
  title?: string;
  children: React.ReactNode;
}

function ControlButton({ onClick, disabled, ariaLabel, title, children }: ControlButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
      className={clsx(
        'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors',
        disabled
          ? 'cursor-not-allowed text-slate-300'
          : 'text-slate-600 hover:bg-slate-100 active:bg-slate-200'
      )}
    >
      {children}
    </button>
  );
}
