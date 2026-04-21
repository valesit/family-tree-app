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
  onViewBirthFamily?: (personId: string, maidenName?: string) => void;
  readOnly?: boolean;
}

type PanSession = {
  pointerId: number;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  moved: boolean;
};

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
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.85 });
  const transformRef = useRef(transform);
  const panSessionRef = useRef<PanSession | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  // Center the tree on mount / data change
  useEffect(() => {
    if (containerRef.current) {
      const { width } = containerRef.current.getBoundingClientRect();
      setTransform((prev) => ({ ...prev, x: width / 3, y: 60 }));
    }
  }, [data]);

  const handleZoomIn = useCallback(() => {
    setTransform((prev) => ({ ...prev, scale: Math.min(prev.scale + 0.15, 1.5) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setTransform((prev) => ({ ...prev, scale: Math.max(prev.scale - 0.15, 0.3) }));
  }, []);

  const handleReset = useCallback(() => {
    if (containerRef.current) {
      const { width } = containerRef.current.getBoundingClientRect();
      setTransform({ x: width / 3, y: 60, scale: 0.85 });
    }
  }, []);

  // Wheel zoom — needs non-passive listener so preventDefault works
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setTransform((prev) => ({
        ...prev,
        scale: Math.max(0.3, Math.min(1.5, prev.scale + delta)),
      }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [data]);

  const handlePointerDownCapture = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-tree-controls]')) return;
    if (e.button !== 0) return;

    const t = transformRef.current;
    panSessionRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: t.x,
      origY: t.y,
      moved: false,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const s = panSessionRef.current;
    if (!s || e.pointerId !== s.pointerId) return;

    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;

    if (Math.hypot(dx, dy) > 6) {
      if (!s.moved) {
        s.moved = true;
        setIsDragging(true);
      }
      setTransform({
        scale: transformRef.current.scale,
        x: s.origX + dx,
        y: s.origY + dy,
      });
    }
  };

  const endPan = (e: React.PointerEvent) => {
    const s = panSessionRef.current;
    if (!s || e.pointerId !== s.pointerId) return;

    if (s.moved && treeView) {
      treeView.markPanEnded();
    }
    panSessionRef.current = null;
    setIsDragging(false);

    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
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
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <div className="w-24 h-24 mb-6 bg-slate-100 rounded-full flex items-center justify-center">
          <Move className="w-12 h-12 text-slate-300" />
        </div>
        <h3 className="text-xl font-semibold text-slate-700 mb-2">No Family Tree Yet</h3>
        <p className="text-sm max-w-md text-center">
          Start building your family tree by adding the first person.
          Click the &quot;Add Person&quot; button to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-white">
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #94a3b8 1px, transparent 1px),
            linear-gradient(to bottom, #94a3b8 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
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
          className="absolute"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
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
        scale={transform.scale}
      />

      <div className="absolute bottom-4 left-4 text-xs text-slate-500 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full border border-slate-200/80 shadow-sm pointer-events-none max-w-[min(100%,20rem)]">
        Drag anywhere to pan · Scroll to zoom · Click a person for details
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
