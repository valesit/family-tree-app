'use client';

import { TreeNode as TreeNodeType, SpouseNode } from '@/types';
import { Avatar } from '@/components/ui';
import { clsx } from 'clsx';
import { ChevronDown, ChevronRight, ChevronUp, Heart, Plus, UserPlus, Users, ExternalLink, Link2 } from 'lucide-react';

interface TreeNodeProps {
  node: TreeNodeType;
  onNodeClick: (node: TreeNodeType) => void;
  onAddChild: (parentId: string) => void;
  onAddSpouse: (personId: string) => void;
  onAddParent?: (childId: string) => void;
  onViewBirthFamily?: (personId: string, maidenName?: string, birthFamilyRootPersonId?: string) => void;
  expandedNodes: Set<string>;
  toggleExpanded: (nodeId: string) => void;
  level: number;
  isRoot?: boolean;
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
}: TreeNodeProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id) || level < 2;

  const getGenderColor = (gender?: string) => {
    switch (gender) {
      case 'MALE':
        return 'border-sky-400 bg-gradient-to-br from-sky-50 to-white';
      case 'FEMALE':
        return 'border-pink-400 bg-gradient-to-br from-pink-50 to-white';
      default:
        return 'border-slate-300 bg-white';
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

      {/* Marriage order badge for multiple spouses */}
      {isSpouse && marriageLabel && (
        <div className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-bold rounded-full z-10">
          {marriageLabel}
        </div>
      )}

      {/* Birth family badge for spouse */}
      {spouseHasBirthFamily && (
        <div 
          className={`absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 text-white text-[8px] font-medium rounded-full whitespace-nowrap flex items-center gap-0.5 z-10 ${
            person.attributes?.birthFamilyId 
              ? 'bg-purple-600 cursor-pointer hover:bg-purple-700' 
              : 'bg-purple-400'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (person.attributes?.birthFamilyId) {
              // Direct link to birth family tree
              onViewBirthFamily?.(person.id, person.attributes.maidenName, person.attributes.birthFamilyId);
            } else {
              // Search for birth family
              onViewBirthFamily?.(person.id, person.attributes?.maidenName);
            }
          }}
          title={person.attributes?.birthFamilyId ? 'View birth family tree' : `Search for ${person.attributes?.maidenName} family`}
        >
          née {person.attributes?.maidenName}
          {person.attributes?.birthFamilyId ? (
            <Link2 className="w-2 h-2" />
          ) : (
            <ExternalLink className="w-2 h-2" />
          )}
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
          <p className="text-rose-400 text-[9px] mt-0.5">
            m. {new Date(person.marriageDate).getFullYear()}
          </p>
        )}
      </div>
    </button>
  );
  };

  return (
    <div className="flex flex-col items-center">
      {/* Add Parent button - only shown at root level */}
      {isRoot && onAddParent && (
        <div className="flex flex-col items-center mb-3">
          <button
            onClick={() => onAddParent(node.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-maroon-500 text-white text-xs font-medium rounded-lg shadow hover:bg-maroon-600 transition-all"
          >
            <ChevronUp className="w-3 h-3" />
            <Users className="w-3 h-3" />
            Add Parent
          </button>
          {/* SVG connector down */}
          <svg width="2" height="16" className="mt-1">
            <line x1="1" y1="0" x2="1" y2="16" stroke="#9f1239" strokeWidth="2" />
          </svg>
        </div>
      )}

      {/* Couple container - supports multiple spouses */}
      <div className="flex items-center gap-2">
        {/* Main person */}
        <div className="relative">
          <PersonCard person={node} />
          {/* Add child button on hover */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(node.id);
            }}
            className="absolute -right-1 top-1/2 -translate-y-1/2 p-1 bg-maroon-500 text-white rounded-full shadow opacity-0 hover:opacity-100 transition-opacity group-hover:opacity-100"
            title="Add child"
          >
            <UserPlus className="w-3 h-3" />
          </button>
        </div>

        {/* Render all spouses with marriage connectors */}
        {allSpouses.map((spouse, index) => (
          <div key={spouse.id} className="flex items-center">
            {/* Marriage connector */}
            <div className="flex items-center">
              <svg width="20" height="2">
                <line x1="0" y1="1" x2="20" y2="1" stroke="#f43f5e" strokeWidth="2" />
              </svg>
              <div className="relative">
                <Heart className="w-5 h-5 text-rose-500 mx-0.5" fill="currentColor" />
                {/* Show marriage number if multiple spouses */}
                {hasMultipleSpouses && (
                  <span className="absolute -top-1 -right-1 text-[8px] font-bold text-rose-600">
                    {index + 1}
                  </span>
                )}
              </div>
              <svg width="20" height="2">
                <line x1="0" y1="1" x2="20" y2="1" stroke="#f43f5e" strokeWidth="2" />
              </svg>
            </div>
            <PersonCard 
              person={spouse} 
              isSpouse 
              marriageOrder={'marriageOrder' in spouse ? (spouse.marriageOrder as number) : index + 1}
              totalSpouses={allSpouses.length}
            />
          </div>
        ))}

        {/* Add spouse button - always visible to allow adding more spouses */}
        <div className="flex items-center">
          <svg width="16" height="2">
            <line x1="0" y1="1" x2="16" y2="1" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="4 2" />
          </svg>
          <button
            onClick={() => onAddSpouse(node.id)}
            className={clsx(
              'flex flex-col items-center justify-center border-2 border-dashed rounded-xl transition-colors bg-slate-50/50',
              'hover:border-maroon-400 hover:text-maroon-500',
              allSpouses.length === 0 
                ? 'w-[100px] h-[100px] border-slate-300 text-slate-400'
                : 'w-14 h-14 border-slate-200 text-slate-300'
            )}
            title={allSpouses.length > 0 ? "Add another spouse" : "Add spouse"}
          >
            <Plus className={allSpouses.length === 0 ? "w-4 h-4" : "w-3 h-3"} />
            {allSpouses.length === 0 && <span className="text-[10px] mt-1">Spouse</span>}
          </button>
        </div>
      </div>

      {/* Children section */}
      {hasChildren && (
        <div className="flex flex-col items-center">
          {/* Vertical line down from couple */}
          <svg width="2" height="20">
            <line x1="1" y1="0" x2="1" y2="20" stroke="#9f1239" strokeWidth="2" />
          </svg>

          {/* Expand/collapse button */}
          <button
            onClick={() => toggleExpanded(node.id)}
            className="p-1 bg-white rounded-full shadow border-2 border-maroon-300 hover:bg-maroon-50 transition-colors z-10"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-maroon-600" />
            ) : (
              <ChevronRight className="w-3 h-3 text-maroon-600" />
            )}
          </button>

          {isExpanded && (
            <>
              {/* Vertical line from button to horizontal bar */}
              <svg width="2" height="16">
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
                  >
                    <line x1="0" y1="1" x2="100%" y2="1" stroke="#9f1239" strokeWidth="2" />
                  </svg>
                )}

                {/* Children nodes */}
                <div className="flex items-start pt-0" style={{ gap: '32px' }}>
                  {node.children!.map((child, index) => (
                    <div key={child.id} className="flex flex-col items-center">
                      {/* Vertical connector from horizontal bar to child */}
                      <svg width="2" height="24">
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
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Add child button when no children */}
      {!hasChildren && level < 4 && (
        <div className="flex flex-col items-center mt-2">
          <svg width="2" height="12">
            <line x1="1" y1="0" x2="1" y2="12" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="4 2" />
          </svg>
          <button
            onClick={() => onAddChild(node.id)}
            className="flex flex-col items-center justify-center w-14 h-14 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 hover:border-maroon-400 hover:text-maroon-500 transition-colors bg-slate-50/50"
          >
            <Plus className="w-3 h-3" />
            <span className="text-[9px]">Child</span>
          </button>
        </div>
      )}
    </div>
  );
}
