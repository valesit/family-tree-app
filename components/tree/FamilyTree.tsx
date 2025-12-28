'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { TreeNode as TreeNodeType } from '@/types';
import { TreeNode } from './TreeNode';
import { TreeControls } from './TreeControls';
import { ZoomIn, ZoomOut, Maximize, Move } from 'lucide-react';

interface FamilyTreeProps {
  data: TreeNodeType | null;
  onNodeClick: (node: TreeNodeType) => void;
  onAddChild: (parentId: string) => void;
  onAddSpouse: (personId: string) => void;
}

export function FamilyTree({ data, onNodeClick, onAddChild, onAddSpouse }: FamilyTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Center the tree on mount
  useEffect(() => {
    if (containerRef.current) {
      const { width } = containerRef.current.getBoundingClientRect();
      setTransform((prev) => ({ ...prev, x: width / 2 - 100 }));
    }
  }, [data]);

  const handleZoomIn = useCallback(() => {
    setTransform((prev) => ({ ...prev, scale: Math.min(prev.scale + 0.2, 2) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setTransform((prev) => ({ ...prev, scale: Math.max(prev.scale - 0.2, 0.4) }));
  }, []);

  const handleReset = useCallback(() => {
    if (containerRef.current) {
      const { width } = containerRef.current.getBoundingClientRect();
      setTransform({ x: width / 2 - 100, y: 50, scale: 1 });
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.4, Math.min(2, prev.scale + delta)),
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
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-slate-500">
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
    <div className="relative w-full h-[calc(100vh-8rem)] overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Background pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Tree container */}
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          className="absolute transition-transform duration-75"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
          }}
        >
          <TreeNode
            node={data}
            onNodeClick={onNodeClick}
            onAddChild={onAddChild}
            onAddSpouse={onAddSpouse}
            expandedNodes={expandedNodes}
            toggleExpanded={toggleExpanded}
            level={0}
          />
        </div>
      </div>

      {/* Controls */}
      <TreeControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
        scale={transform.scale}
      />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-slate-200">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Legend</h4>
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-xs text-slate-600">Living</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-slate-400" />
            <span className="text-xs text-slate-600">Deceased</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-sky-500" />
            <span className="text-xs text-slate-600">Male</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-pink-500" />
            <span className="text-xs text-slate-600">Female</span>
          </div>
        </div>
      </div>
    </div>
  );
}

