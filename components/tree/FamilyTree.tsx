'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { TreeNode as TreeNodeType } from '@/types';
import { TreeNode } from './TreeNode';
import { TreeControls } from './TreeControls';
import { Move } from 'lucide-react';

interface FamilyTreeProps {
  data: TreeNodeType | null;
  onNodeClick: (node: TreeNodeType) => void;
  onAddChild: (parentId: string) => void;
  onAddSpouse: (personId: string) => void;
  onAddParent?: (childId: string) => void;
  onViewBirthFamily?: (personId: string, maidenName?: string) => void;
}

export function FamilyTree({ data, onNodeClick, onAddChild, onAddSpouse, onAddParent, onViewBirthFamily }: FamilyTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.85 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // Track if we should be listening for drag
  const isPotentialDrag = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  // Center the tree on mount
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

  // Check if click is on an interactive element
  const isInteractiveElement = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;
    
    // Check if target or any parent is a button or has role="button"
    let element: HTMLElement | null = target;
    while (element) {
      if (
        element.tagName === 'BUTTON' ||
        element.tagName === 'A' ||
        element.getAttribute('role') === 'button' ||
        element.onclick !== null ||
        element.dataset.clickable === 'true'
      ) {
        return true;
      }
      element = element.parentElement;
    }
    return false;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Don't start drag if clicking on an interactive element
    if (isInteractiveElement(e.target)) {
      return;
    }
    
    if (e.button === 0) {
      isPotentialDrag.current = true;
      startPos.current = { x: e.clientX, y: e.clientY };
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPotentialDrag.current) return;

    const dx = Math.abs(e.clientX - startPos.current.x);
    const dy = Math.abs(e.clientY - startPos.current.y);
    
    // Start dragging only after moving 8+ pixels (like dnd-kit)
    if (dx > 8 || dy > 8) {
      setIsDragging(true);
    }

    if (isDragging) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }));
    }
  };

  const handlePointerUp = () => {
    isPotentialDrag.current = false;
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.3, Math.min(1.5, prev.scale + delta)),
    }));
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
    <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #94a3b8 1px, transparent 1px),
            linear-gradient(to bottom, #94a3b8 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Tree container - handles drag */}
      <div
        ref={containerRef}
        className={`absolute inset-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
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
            onAddChild={onAddChild}
            onAddSpouse={onAddSpouse}
            onAddParent={onAddParent}
            onViewBirthFamily={onViewBirthFamily}
            expandedNodes={expandedNodes}
            toggleExpanded={toggleExpanded}
            level={0}
            isRoot={true}
          />
        </div>
      </div>

      {/* Controls - positioned in bottom right */}
      <TreeControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
        scale={transform.scale}
      />

      {/* Drag hint */}
      <div className="absolute bottom-4 left-4 text-xs text-slate-400 bg-white/80 px-3 py-1.5 rounded-full shadow-sm pointer-events-none">
        Drag to pan • Scroll to zoom • Click person for details
      </div>
    </div>
  );
}
