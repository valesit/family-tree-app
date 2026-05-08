'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { TreeNode as TreeNodeType } from '@/types';
import { TreeNode } from './TreeNode';
import { TreeControls } from './TreeControls';
import { TreeViewProvider, useTreeViewOptional } from './TreeViewContext';
import { Move } from 'lucide-react';

interface FamilyTreeProps {
  data: TreeNodeType | null;
  onNodeClick: (node: TreeNodeType) => void;
  onAddChild?: (parentId: string) => void;
  onAddSpouse?: (personId: string) => void;
  onAddParent?: (childId: string) => void;
  onViewBirthFamily?: (personId: string, maidenName?: string, birthFamilyRootPersonId?: string) => void;
  readOnly?: boolean;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 2;
const FIT_PADDING = 24; // px around bbox when fitting

/** Open first two generations by default (depth 0–1 nodes with children). */
function collectDefaultExpandedIds(node: TreeNodeType | null): Set<string> {
  const ids = new Set<string>();
  if (!node) return ids;

  function walk(n: TreeNodeType, depth: number) {
    if (n.children && n.children.length > 0 && depth < 2) {
      ids.add(n.id);
      for (const c of n.children) {
        walk(c, depth + 1);
      }
    }
  }
  walk(node, 0);
  return ids;
}

type Transform = { x: number; y: number; scale: number };

type PanSession = {
  pointerId: number;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  moved: boolean;
  captureActive: boolean;
  /** Pointer started on a button/link — suppress click after pan */
  startOnInteractive: boolean;
};

type PinchSession = {
  /** Initial distance between the two pointers in client coords */
  startDistance: number;
  /** Initial midpoint between the two pointers in client coords */
  startMidpointX: number;
  startMidpointY: number;
  /** Transform when the pinch began */
  origTransform: Transform;
};

function clampScale(s: number) {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
}

function FamilyTreeInner({
  data,
  onNodeClick,
  onAddChild,
  onAddSpouse,
  onAddParent,
  onViewBirthFamily,
  readOnly = false,
}: FamilyTreeProps) {
  const treeView = useTreeViewOptional();
  const containerRef = useRef<HTMLDivElement>(null);
  /** Inner positioned wrapper around the tree (used for bbox / fit) */
  const contentRef = useRef<HTMLDivElement>(null);

  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 0.85 });
  const transformRef = useRef(transform);
  const panSessionRef = useRef<PanSession | null>(null);
  const pinchRef = useRef<PinchSession | null>(null);
  /** Active pointers, tracked for pinch detection */
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  const [isDragging, setIsDragging] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  useEffect(() => {
    if (data) {
      setExpandedNodes(collectDefaultExpandedIds(data));
    }
  }, [data]);

  /**
   * Fit the entire tree inside the visible container, with padding.
   *
   * - We use `scrollWidth`/`scrollHeight` on the unscaled content so the
   *   measurement is independent of the current scale — this is more robust
   *   than dividing a transformed `getBoundingClientRect` by the scale, which
   *   can be off by a fraction of a px and creep on repeated fits.
   * - The Y axis centers when the tree is shorter than the viewport and
   *   pins to the top (with padding) when it's taller, so deep trees never
   *   get clipped at the bottom after expanding a branch.
   */
  const handleFit = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const cRect = container.getBoundingClientRect();
    /** scrollWidth/Height are pre-transform (intrinsic) sizes. */
    const naturalW = content.scrollWidth;
    const naturalH = content.scrollHeight;
    if (naturalW <= 0 || naturalH <= 0) return;

    const availW = Math.max(1, cRect.width - FIT_PADDING * 2);
    const availH = Math.max(1, cRect.height - FIT_PADDING * 2);
    const nextScale = clampScale(Math.min(availW / naturalW, availH / naturalH));

    const scaledW = naturalW * nextScale;
    const scaledH = naturalH * nextScale;
    const nextX = Math.max(FIT_PADDING, (cRect.width - scaledW) / 2);
    const nextY =
      scaledH + FIT_PADDING * 2 <= cRect.height
        ? (cRect.height - scaledH) / 2
        : FIT_PADDING;

    setTransform({ x: nextX, y: nextY, scale: nextScale });
  }, []);

  /**
   * Re-fit on data change AND whenever a branch is opened or collapsed so the
   * whole tree (with all currently-open branches) stays visible.
   *
   * Two rAFs ensure React has committed the new DOM and the browser has
   * painted it before we measure — a single setTimeout was sometimes firing
   * mid-layout on slower devices, producing a measurement based on the
   * pre-expand size.
   */
  useEffect(() => {
    if (!data) return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(handleFit);
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [data, expandedNodes, handleFit]);

  /**
   * Re-fit when the container itself resizes (rotation, address bar show/hide,
   * keyboard appearing, etc). Without this, a viewport change leaves the tree
   * either clipped or floating in dead space until the user touches it.
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      // Defer to avoid measuring during the same frame as the resize.
      window.requestAnimationFrame(handleFit);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [handleFit]);

  const handleZoomIn = useCallback(() => {
    setTransform((prev) => ({ ...prev, scale: clampScale(prev.scale + 0.15) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setTransform((prev) => ({ ...prev, scale: clampScale(prev.scale - 0.15) }));
  }, []);

  const handleReset = useCallback(() => {
    handleFit();
  }, [handleFit]);

  // Wheel zoom for desktop (mobile uses pinch)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setTransform((prev) => ({ ...prev, scale: clampScale(prev.scale + delta) }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [data]);

  // ---------- Pointer / pan / pinch handling ----------

  const startPinchIfNeeded = useCallback(() => {
    const pts = Array.from(activePointersRef.current.values());
    if (pts.length < 2) return;
    const [a, b] = pts;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    pinchRef.current = {
      startDistance: Math.hypot(dx, dy) || 1,
      startMidpointX: (a.x + b.x) / 2,
      startMidpointY: (a.y + b.y) / 2,
      origTransform: { ...transformRef.current },
    };
    // Cancel any single-finger pan so the gesture switches cleanly to pinch.
    panSessionRef.current = null;
    setIsDragging(false);
  }, []);

  const handlePointerDownCapture = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-tree-controls]')) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // If a second finger came down, switch to pinch and stop pan.
    if (activePointersRef.current.size >= 2) {
      startPinchIfNeeded();
      return;
    }

    // Only buttons fire pointerdown reliably with `e.button === 0` for mouse;
    // touch always reports 0, so this also works on touch.
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const startOnInteractive = !!(e.target as HTMLElement).closest(
      'button, a[href], [role="button"]'
    );

    const t = transformRef.current;
    panSessionRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: t.x,
      origY: t.y,
      moved: false,
      captureActive: false,
      startOnInteractive,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Pinch zoom takes priority when two pointers are active.
    if (activePointersRef.current.size >= 2 && pinchRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const [a, b] = pts;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.hypot(dx, dy) || 1;
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;

      const orig = pinchRef.current.origTransform;
      const ratio = dist / pinchRef.current.startDistance;
      const nextScale = clampScale(orig.scale * ratio);

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      // Convert original midpoint into content coordinates (pre-transform space).
      const cx = pinchRef.current.startMidpointX - rect.left;
      const cy = pinchRef.current.startMidpointY - rect.top;
      const contentX = (cx - orig.x) / orig.scale;
      const contentY = (cy - orig.y) / orig.scale;

      // Move so the new midpoint anchors to the same content point + the
      // user's current finger midpoint relative to the container.
      const mx = midX - rect.left;
      const my = midY - rect.top;
      const nextX = mx - contentX * nextScale;
      const nextY = my - contentY * nextScale;

      setTransform({ x: nextX, y: nextY, scale: nextScale });
      return;
    }

    // Single-finger pan
    const s = panSessionRef.current;
    if (!s || e.pointerId !== s.pointerId) return;

    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;

    if (Math.hypot(dx, dy) > 6) {
      s.moved = true;
      if (!s.captureActive) {
        s.captureActive = true;
        setIsDragging(true);
        if (s.startOnInteractive && treeView) {
          treeView.markPanEnded();
        }
        try {
          containerRef.current?.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      setTransform({
        scale: transformRef.current.scale,
        x: s.origX + dx,
        y: s.origY + dy,
      });
    }
  };

  const endPan = (e: React.PointerEvent) => {
    activePointersRef.current.delete(e.pointerId);

    // If we drop below 2 pointers, end any pinch.
    if (activePointersRef.current.size < 2 && pinchRef.current) {
      pinchRef.current = null;
    }

    const s = panSessionRef.current;
    if (s && e.pointerId === s.pointerId) {
      panSessionRef.current = null;
      setIsDragging(false);
      if (s.captureActive) {
        try {
          if (containerRef.current?.hasPointerCapture?.(e.pointerId)) {
            containerRef.current.releasePointerCapture(e.pointerId);
          }
        } catch {
          /* ignore */
        }
      }
    }
  };

  const toggleExpanded = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500" role="status">
        <div className="w-24 h-24 mb-6 bg-slate-100 rounded-full flex items-center justify-center" aria-hidden>
          <Move className="w-12 h-12 text-slate-300" />
        </div>
        <h3 className="text-xl font-semibold text-slate-700 mb-2">No Family Tree Yet</h3>
        <p className="text-sm max-w-md text-center px-4">
          Start building your family tree by adding the first person.
          Tap &ldquo;Add Person&rdquo; to get started.
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-white"
      role="region"
      aria-label="Interactive family tree"
    >
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #94a3b8 1px, transparent 1px),
            linear-gradient(to bottom, #94a3b8 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
        aria-hidden="true"
      />

      <div
        ref={containerRef}
        className={`absolute inset-0 touch-none select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDownCapture={handlePointerDownCapture}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onLostPointerCapture={endPan}
      >
        <div
          ref={contentRef}
          className="absolute"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            transition: isDragging || pinchRef.current ? 'none' : 'transform 0.15s ease-out',
          }}
        >
          <TreeNode
            node={data}
            onNodeClick={onNodeClick}
            onAddChild={readOnly ? undefined : onAddChild}
            onAddSpouse={readOnly ? undefined : onAddSpouse}
            onAddParent={readOnly ? undefined : onAddParent}
            onViewBirthFamily={onViewBirthFamily}
            expandedNodes={expandedNodes}
            toggleExpanded={toggleExpanded}
            level={0}
            isRoot={true}
            readOnly={readOnly}
          />
        </div>
      </div>

      <TreeControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
        onFit={handleFit}
        scale={transform.scale}
      />

      <div
        className="pointer-events-none absolute bottom-3 left-3 max-w-[min(100%,20rem)] rounded-full border border-slate-200/80 bg-white/90 px-3 py-1.5 text-[11px] text-slate-500 shadow-sm backdrop-blur-sm sm:bottom-4 sm:left-4 sm:text-xs"
        role="note"
      >
        <span className="hidden sm:inline">Drag to pan · Scroll or pinch to zoom · Tap a person for details</span>
        <span className="sm:hidden">Drag to pan · Pinch to zoom · Tap to view</span>
      </div>
    </div>
  );
}

export function FamilyTree(props: FamilyTreeProps) {
  return (
    <TreeViewProvider>
      <FamilyTreeInner {...props} />
    </TreeViewProvider>
  );
}
