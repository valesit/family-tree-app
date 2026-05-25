'use client';

import { TreeNode as TreeNodeType, SpouseNode } from '@/types';
import { Avatar } from '@/components/ui';
import { clsx } from 'clsx';
import { useTreeViewOptional } from './TreeViewContext';
import { ChevronDown, ChevronRight, ChevronUp, Heart, Plus, UserPlus, Users, AlertCircle } from 'lucide-react';

interface TreeNodeProps {
  node: TreeNodeType;
  onNodeClick: (node: TreeNodeType) => void;
  onAddChild?: (parentId: string) => void;
  onAddSpouse?: (personId: string) => void;
  onAddParent?: (childId: string) => void;
  /** Kept on the prop type only for backwards-compat with existing callers. */
  onViewBirthFamily?: (personId: string, maidenName?: string) => void;
  expandedNodes: Set<string>;
  toggleExpanded: (nodeId: string) => void;
  level: number;
  isRoot?: boolean;
  readOnly?: boolean;
}

export function TreeNode({
  node,
  onNodeClick,
  onAddChild,
  onAddSpouse,
  onAddParent,
  onViewBirthFamily,
  expandedNodes,
  toggleExpanded,
  level,
  isRoot = false,
  readOnly = false,
}: TreeNodeProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);

  const getGenderColor = (gender?: string) => {
    switch (gender) {
      case 'MALE':
        return 'border-slate-200 bg-white ring-1 ring-inset ring-sky-200/70';
      case 'FEMALE':
        return 'border-slate-200 bg-white ring-1 ring-inset ring-maroon-200/60';
      default:
        return 'border-slate-200 bg-white';
    }
  };

  const getStatusIndicator = (isLiving?: boolean) => {
    if (!isLiving) {
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

  // Get all spouses (multiple wives/husbands support)
  const allSpouses = node.spouses || (node.spouse ? [node.spouse] : []);
  const hasMultipleSpouses = allSpouses.length > 1;

  // Check if a spouse has birth family info
  const checkBirthFamily = (spouse: TreeNodeType) => 
    spouse.attributes?.maidenName && spouse.attributes.maidenName !== spouse.lastName;

  // Get marriage order label
  const getMarriageLabel = (order?: number, totalSpouses?: number) => {
    if (!order || !totalSpouses || totalSpouses <= 1) return null;
    const ordinalSuffixes = ['', '1st', '2nd', '3rd', '4th', '5th'];
    return ordinalSuffixes[order] || `${order}th`;
  };

  const treeView = useTreeViewOptional();

  // Person Card Component
  const PersonCard = ({ person, isSpouse = false, marriageOrder, totalSpouses }: { 
    person: TreeNodeType | SpouseNode; 
    isSpouse?: boolean;
    marriageOrder?: number;
    totalSpouses?: number;
  }) => {
    const spouseHasBirthFamily = isSpouse && checkBirthFamily(person);
    const marriageLabel = getMarriageLabel(marriageOrder, totalSpouses);
    
    return (
    <button
      type="button"
      data-clickable="true"
      onClick={(e) => {
        e.stopPropagation();
        if (treeView?.consumeIfSuppressClick()) return;
        onNodeClick(person);
      }}
      className={clsx(
        'relative bg-white rounded-xl p-3 shadow-md border-2 transition-all duration-200 min-w-[120px]',
        'hover:shadow-lg hover:scale-[1.02] cursor-pointer',
        isRoot && !isSpouse && 'ring-2 ring-maroon-300 ring-offset-2',
        getGenderColor(person.gender)
      )}
    >
      {/* Root badge */}
      {isRoot && !isSpouse && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-maroon-500 text-white text-[9px] font-semibold rounded-full">
          Root
        </div>
      )}

      {/* Quiet unverified indicator — small outline dot in the corner instead of a banner */}
      {person.isVerified === false && (
        <div
          className="absolute -top-1.5 -left-1.5 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-white text-amber-500 ring-1 ring-amber-300"
          title="Recently added — pending review"
          aria-label="Recently added"
        >
          <AlertCircle className="h-3 w-3" aria-hidden />
        </div>
      )}

      {/* Marriage order badge for multiple spouses */}
      {isSpouse && marriageLabel && (
        <div className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-bold rounded-full z-10">
          {marriageLabel}
        </div>
      )}

      {/* Maiden name as a quiet "née ___" label — no longer a clickable link to a separate tree.
          Spouse parents now grow the same tree horizontally via the standard Add Parent flow. */}
      {spouseHasBirthFamily && (
        <div
          className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-purple-100 px-2 py-0.5 text-[8px] font-medium text-purple-700 ring-1 ring-purple-200"
          title={`Maiden name: ${person.attributes?.maidenName}`}
        >
          née {person.attributes?.maidenName}
        </div>
      )}

      <div className="relative mx-auto w-fit">
        <Avatar
          src={person.profileImage}
          name={person.name}
          size="lg"
          className="ring-2 ring-white shadow-sm"
        />
        {getStatusIndicator(person.isLiving)}
      </div>

      <div className="mt-2 text-center">
        <p className="font-semibold text-slate-800 text-sm leading-tight">
          {person.firstName}
        </p>
        <p className="text-slate-500 text-xs">{person.lastName}</p>
        {person.attributes?.birthYear && (
          <p className="text-slate-400 text-[10px] mt-0.5">
            {person.attributes.birthYear}
            {person.attributes.deathYear && ` - ${person.attributes.deathYear}`}
          </p>
        )}
        {/* Marriage date for spouses */}
        {isSpouse && 'marriageDate' in person && person.marriageDate && (
          <p className="text-slate-400 text-[9px] mt-0.5">
            m. {new Date(person.marriageDate).getFullYear()}
          </p>
        )}
      </div>
    </button>
  );
  };

  return (
    <div className="flex flex-col items-center">
      {/* Add Parent button - only shown at root level in edit mode */}
      {isRoot && onAddParent && !readOnly && (
        <div className="flex flex-col items-center mb-3">
          <button
            type="button"
            onClick={() => onAddParent(node.id)}
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-maroon-500 px-3 py-2 text-xs font-medium text-white shadow transition-all hover:bg-maroon-600"
            aria-label={`Add parent to ${node.firstName}`}
          >
            <ChevronUp className="h-3 w-3" aria-hidden />
            <Users className="h-3 w-3" aria-hidden />
            Add Parent
          </button>
          {/* SVG connector down */}
          <svg width="2" height="16" className="mt-1" aria-hidden>
            <line x1="1" y1="0" x2="1" y2="16" stroke="#9f1239" strokeWidth="2" />
          </svg>
        </div>
      )}

      {/* Couple container - supports multiple spouses */}
      <div className="flex items-center gap-2">
        {/* Main person */}
        <div className="relative">
          <PersonCard person={node} />
          {/* Add child button on hover - hidden in read-only mode */}
          {!readOnly && onAddChild && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(node.id);
              }}
              className="absolute -right-1 top-1/2 flex min-h-[28px] min-w-[28px] -translate-y-1/2 items-center justify-center rounded-full bg-maroon-500 p-1.5 text-white shadow transition-opacity hover:bg-maroon-600"
              title="Add child"
              aria-label={`Add a child to ${node.firstName}`}
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>

        {/* Render all spouses with marriage connectors */}
        {allSpouses.map((spouse, index) => (
          <div key={spouse.id} className="flex items-center">
            {/* Marriage connector */}
            <div className="flex items-center" aria-hidden>
              <svg width="20" height="2" aria-hidden>
                <line x1="0" y1="1" x2="20" y2="1" stroke="#94a3b8" strokeWidth="2" />
              </svg>
              <div className="relative">
                <Heart className="w-5 h-5 text-maroon-500 mx-0.5" fill="currentColor" />
                {/* Show marriage number if multiple spouses */}
                {hasMultipleSpouses && (
                  <span className="absolute -top-1 -right-1 text-[8px] font-bold text-maroon-700">
                    {index + 1}
                  </span>
                )}
              </div>
              <svg width="20" height="2" aria-hidden>
                <line x1="0" y1="1" x2="20" y2="1" stroke="#94a3b8" strokeWidth="2" />
              </svg>
            </div>
            {/* Spouse column: optional "Add parents" pill above the card, then the card itself.
                This is how relatives grow the tree horizontally with the spouse's parents,
                in the SAME tree. */}
            <div className="flex flex-col items-center">
              {!readOnly && onAddParent && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddParent(spouse.id);
                  }}
                  className="mb-1.5 inline-flex min-h-[28px] items-center gap-1 rounded-full border border-maroon-200 bg-white px-2.5 py-1 text-[10px] font-medium text-maroon-700 shadow-sm transition-colors hover:bg-maroon-50 active:bg-maroon-100"
                  aria-label={`Add ${spouse.firstName}'s parents to the tree`}
                  title={`Add ${spouse.firstName}'s parents`}
                >
                  <ChevronUp className="h-3 w-3" aria-hidden />
                  Add parents
                </button>
              )}
              <PersonCard
                person={spouse}
                isSpouse
                marriageOrder={'marriageOrder' in spouse ? (spouse.marriageOrder as number) : index + 1}
                totalSpouses={allSpouses.length}
              />
            </div>
          </div>
        ))}

        {/* Add spouse button - hidden in read-only mode */}
        {!readOnly && onAddSpouse && (
          <div className="flex items-center">
            <svg width="16" height="2" aria-hidden>
              <line x1="0" y1="1" x2="16" y2="1" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="4 2" />
            </svg>
            <button
              type="button"
              onClick={() => onAddSpouse(node.id)}
              className={clsx(
                'flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-slate-50/50 transition-colors',
                'hover:border-maroon-400 hover:text-maroon-500 active:bg-slate-100',
                allSpouses.length === 0
                  ? 'h-[100px] w-[100px] border-slate-300 text-slate-400'
                  : 'h-14 w-14 border-slate-200 text-slate-300'
              )}
              title={allSpouses.length > 0 ? 'Add another spouse' : 'Add spouse'}
              aria-label={
                allSpouses.length > 0
                  ? `Add another spouse to ${node.firstName}`
                  : `Add spouse to ${node.firstName}`
              }
            >
              <Plus className={allSpouses.length === 0 ? 'h-4 w-4' : 'h-3 w-3'} aria-hidden />
              {allSpouses.length === 0 && <span className="mt-1 text-[10px]">Spouse</span>}
            </button>
          </div>
        )}
      </div>

      {/* Children section */}
      {hasChildren && (
        <div className="flex flex-col items-center">
          {/* Vertical line down from couple */}
          <svg width="2" height="20" aria-hidden>
            <line x1="1" y1="0" x2="1" y2="20" stroke="#9f1239" strokeWidth="2" />
          </svg>

          {/* Expand/collapse button — sized for touch */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(node.id);
            }}
            className="z-10 flex h-8 min-w-[2rem] items-center justify-center rounded-full border-2 border-maroon-300 bg-white shadow transition-colors hover:bg-maroon-50 active:bg-maroon-100"
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? `Collapse ${node.firstName}'s descendants`
                : `Expand ${node.firstName}'s descendants`
            }
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-maroon-600" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4 text-maroon-600" aria-hidden />
            )}
          </button>

          {isExpanded && (
            <>
              {/* Vertical line from button to horizontal bar */}
              <svg width="2" height="16" aria-hidden>
                <line x1="1" y1="0" x2="1" y2="16" stroke="#9f1239" strokeWidth="2" />
              </svg>

              {/* Children with connectors */}
              <div className="relative">
                {/* Horizontal connector bar - spans all children */}
                {node.children!.length > 1 && (
                  <svg 
                    className="absolute top-0 left-0 right-0" 
                    height="2" 
                    style={{ width: '100%' }}
                   aria-hidden>
                    <line x1="0" y1="1" x2="100%" y2="1" stroke="#9f1239" strokeWidth="2" />
                  </svg>
                )}

                {/* Children nodes */}
                <div className="flex items-start pt-0" style={{ gap: '32px' }}>
                  {node.children!.map((child, index) => (
                    <div key={child.id} className="flex flex-col items-center">
                      {/* Vertical connector from horizontal bar to child */}
                      <svg width="2" height="24" aria-hidden>
                        <line x1="1" y1="0" x2="1" y2="24" stroke="#9f1239" strokeWidth="2" />
                      </svg>
                      <TreeNode
                        node={child}
                        onNodeClick={onNodeClick}
                        onAddChild={onAddChild}
                        onAddSpouse={onAddSpouse}
                        onAddParent={onAddParent}
                        onViewBirthFamily={onViewBirthFamily}
                        expandedNodes={expandedNodes}
                        toggleExpanded={toggleExpanded}
                        level={level + 1}
                        readOnly={readOnly}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Add child button when no children - hidden in read-only mode */}
      {!hasChildren && level < 4 && !readOnly && onAddChild && (
        <div className="flex flex-col items-center mt-2">
          <svg width="2" height="12" aria-hidden>
            <line x1="1" y1="0" x2="1" y2="12" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="4 2" />
          </svg>
          <button
            type="button"
            onClick={() => onAddChild(node.id)}
            className="flex h-14 w-14 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/50 text-slate-400 transition-colors hover:border-maroon-400 hover:text-maroon-500 active:bg-slate-100"
            aria-label={`Add a child to ${node.firstName}`}
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span className="text-[9px]">Child</span>
          </button>
        </div>
      )}
    </div>
  );
}
