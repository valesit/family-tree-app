'use client';

import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';
import { clsx } from 'clsx';

interface TreeControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFit?: () => void;
  scale: number;
}

export function TreeControls({ onZoomIn, onZoomOut, onReset, onFit, scale }: TreeControlsProps) {
  const zoomPercentage = Math.round(scale * 100);
  const fitHandler = onFit ?? onReset;

  return (
    <div
      className="absolute left-3 top-3 z-10 flex flex-col items-center sm:left-5 sm:top-5"
      data-tree-controls
      role="toolbar"
      aria-label="Tree zoom controls"
    >
      <div className="flex flex-col overflow-hidden rounded-xl border border-[#e1d7ce] bg-[#fffdf9]/95 p-1 shadow-[0_8px_24px_-14px_rgba(60,40,30,0.35)] backdrop-blur-sm">
        <ControlButton onClick={onZoomIn} disabled={scale >= 2} ariaLabel="Zoom in" title="Zoom in">
          <ZoomIn className="h-4 w-4" aria-hidden />
        </ControlButton>

        <div className="px-1 py-0.5 text-center" aria-live="polite">
          <span className="text-[9px] font-medium tabular-nums text-[#94867d]">{zoomPercentage}%</span>
        </div>

        <ControlButton onClick={onZoomOut} disabled={scale <= 0.25} ariaLabel="Zoom out" title="Zoom out">
          <ZoomOut className="h-4 w-4" aria-hidden />
        </ControlButton>

        <div className="mx-1 my-1 h-px bg-[#eadfd6]" aria-hidden />

        <ControlButton onClick={fitHandler} ariaLabel="Fit tree to screen" title="Fit to screen">
          <Maximize2 className="h-4 w-4" aria-hidden />
        </ControlButton>
        <ControlButton onClick={onReset} ariaLabel="Reset view" title="Reset view">
          <RotateCcw className="h-4 w-4" aria-hidden />
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
        'grid h-9 w-9 place-items-center rounded-lg transition-colors',
        disabled ? 'cursor-not-allowed text-[#cfc5bd]' : 'text-[#6f625a] hover:bg-[#f5eee8] hover:text-maroon-700 active:bg-[#eee4dc]'
      )}
    >
      {children}
    </button>
  );
}
