'use client';

import { TreeNode as TreeNodeType } from '@/types';
import { Avatar } from '@/components/ui';
import { clsx } from 'clsx';
import { ChevronDown, ChevronRight, Heart, Plus, UserPlus } from 'lucide-react';

interface TreeNodeProps {
  node: TreeNodeType;
  onNodeClick: (node: TreeNodeType) => void;
  onAddChild: (parentId: string) => void;
  onAddSpouse: (personId: string) => void;
  expandedNodes: Set<string>;
  toggleExpanded: (nodeId: string) => void;
  level: number;
}

export function TreeNode({
  node,
  onNodeClick,
  onAddChild,
  onAddSpouse,
  expandedNodes,
  toggleExpanded,
  level,
}: TreeNodeProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id) || level < 2; // Auto-expand first 2 levels

  const getGenderColor = (gender?: string) => {
    switch (gender) {
      case 'MALE':
        return 'border-sky-400';
      case 'FEMALE':
        return 'border-pink-400';
      default:
        return 'border-slate-300';
    }
  };

  const getStatusIndicator = () => {
    if (!node.isLiving) {
      return (
        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-slate-400 rounded-full border-2 border-white flex items-center justify-center">
          <span className="text-white text-[8px]">†</span>
        </div>
      );
    }
    return (
      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
    );
  };

  return (
    <div className="flex flex-col items-center">
      {/* Person node with spouse */}
      <div className="flex items-center gap-4">
        {/* Main person */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => onNodeClick(node)}
            className={clsx(
              'group relative bg-white rounded-2xl p-4 shadow-lg border-2 transition-all duration-200',
              'hover:shadow-xl hover:scale-105 hover:border-emerald-400',
              getGenderColor(node.gender)
            )}
          >
            <div className="relative">
              <Avatar
                src={node.profileImage}
                name={node.name}
                size="xl"
                className={clsx(
                  'ring-4',
                  node.isLiving ? 'ring-emerald-100' : 'ring-slate-100'
                )}
              />
              {getStatusIndicator()}
            </div>

            {/* Name and info */}
            <div className="mt-3 text-center max-w-[120px]">
              <p className="font-semibold text-slate-900 text-sm truncate">
                {node.firstName}
              </p>
              <p className="text-slate-500 text-xs truncate">{node.lastName}</p>
              {node.attributes?.birthYear && (
                <p className="text-slate-400 text-xs mt-1">
                  {node.attributes.birthYear}
                  {node.attributes.deathYear && ` - ${node.attributes.deathYear}`}
                </p>
              )}
            </div>

            {/* Quick actions on hover */}
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddChild(node.id);
                }}
                className="p-1.5 bg-emerald-500 text-white rounded-full shadow-lg hover:bg-emerald-600 transition-colors"
                title="Add child"
              >
                <UserPlus className="w-3 h-3" />
              </button>
            </div>
          </button>
        </div>

        {/* Spouse */}
        {node.spouse && (
          <>
            <div className="flex items-center">
              <div className="w-8 h-0.5 bg-rose-300" />
              <Heart className="w-5 h-5 text-rose-400 mx-1" fill="currentColor" />
              <div className="w-8 h-0.5 bg-rose-300" />
            </div>
            <button
              onClick={() => onNodeClick(node.spouse!)}
              className={clsx(
                'group relative bg-white rounded-2xl p-4 shadow-lg border-2 transition-all duration-200',
                'hover:shadow-xl hover:scale-105 hover:border-emerald-400',
                getGenderColor(node.spouse.gender)
              )}
            >
              <div className="relative">
                <Avatar
                  src={node.spouse.profileImage}
                  name={node.spouse.name}
                  size="xl"
                  className={clsx(
                    'ring-4',
                    node.spouse.isLiving ? 'ring-emerald-100' : 'ring-slate-100'
                  )}
                />
                {node.spouse.isLiving ? (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
                ) : (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-slate-400 rounded-full border-2 border-white flex items-center justify-center">
                    <span className="text-white text-[8px]">†</span>
                  </div>
                )}
              </div>
              <div className="mt-3 text-center max-w-[120px]">
                <p className="font-semibold text-slate-900 text-sm truncate">
                  {node.spouse.firstName}
                </p>
                <p className="text-slate-500 text-xs truncate">{node.spouse.lastName}</p>
              </div>
            </button>
          </>
        )}

        {/* Add spouse button */}
        {!node.spouse && (
          <button
            onClick={() => onAddSpouse(node.id)}
            className="flex flex-col items-center justify-center w-20 h-24 border-2 border-dashed border-slate-300 rounded-2xl text-slate-400 hover:border-emerald-400 hover:text-emerald-500 transition-colors"
          >
            <Plus className="w-5 h-5 mb-1" />
            <span className="text-xs">Spouse</span>
          </button>
        )}
      </div>

      {/* Expand/collapse button */}
      {hasChildren && (
        <button
          onClick={() => toggleExpanded(node.id)}
          className="mt-4 p-1.5 bg-white rounded-full shadow-md border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
        </button>
      )}

      {/* Connector line */}
      {hasChildren && isExpanded && (
        <div className="w-0.5 h-8 bg-slate-300" />
      )}

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="relative">
          {/* Horizontal connector */}
          {node.children!.length > 1 && (
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 bg-slate-300"
              style={{
                width: `${(node.children!.length - 1) * 200}px`,
              }}
            />
          )}

          {/* Children nodes */}
          <div className="flex gap-8 pt-8">
            {node.children!.map((child, index) => (
              <div key={child.id} className="relative flex flex-col items-center">
                {/* Vertical connector */}
                <div className="absolute -top-8 w-0.5 h-8 bg-slate-300" />
                <TreeNode
                  node={child}
                  onNodeClick={onNodeClick}
                  onAddChild={onAddChild}
                  onAddSpouse={onAddSpouse}
                  expandedNodes={expandedNodes}
                  toggleExpanded={toggleExpanded}
                  level={level + 1}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add child button when no children */}
      {!hasChildren && level < 4 && (
        <button
          onClick={() => onAddChild(node.id)}
          className="mt-4 flex flex-col items-center justify-center w-16 h-16 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 hover:border-emerald-400 hover:text-emerald-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-[10px]">Child</span>
        </button>
      )}
    </div>
  );
}

