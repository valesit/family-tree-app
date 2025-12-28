'use client';

import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';

interface TreeControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  scale: number;
}

export function TreeControls({ onZoomIn, onZoomOut, onReset, scale }: TreeControlsProps) {
  const zoomPercentage = Math.round(scale * 100);

  return (
    <div className="absolute top-4 right-4 flex flex-col items-center space-y-2">
      <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 p-1 flex flex-col">
        <button
          onClick={onZoomIn}
          disabled={scale >= 2}
          className={clsx(
            'p-2 rounded-lg transition-colors',
            scale >= 2
              ? 'text-slate-300 cursor-not-allowed'
              : 'text-slate-600 hover:bg-slate-100'
          )}
          title="Zoom in"
        >
          <ZoomIn className="w-5 h-5" />
        </button>

        <div className="px-2 py-1 text-center">
          <span className="text-xs font-medium text-slate-500">{zoomPercentage}%</span>
        </div>

        <button
          onClick={onZoomOut}
          disabled={scale <= 0.4}
          className={clsx(
            'p-2 rounded-lg transition-colors',
            scale <= 0.4
              ? 'text-slate-300 cursor-not-allowed'
              : 'text-slate-600 hover:bg-slate-100'
          )}
          title="Zoom out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>

        <div className="w-full h-px bg-slate-200 my-1" />

        <button
          onClick={onReset}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          title="Reset view"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Instructions */}
      <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow border border-slate-200">
        <p className="text-[10px] text-slate-500 text-center">
          Drag to pan • Scroll to zoom
        </p>
      </div>
    </div>
  );
}

