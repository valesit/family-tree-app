'use client';

import { useState } from 'react';
import { TreeNode as TreeNodeType, SpouseNode } from '@/types';
import { Avatar } from '@/components/ui';
import { clsx } from 'clsx';
import { useTreeViewOptional } from './TreeViewContext';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Heart,
  Plus,
  UserPlus,
  Users,
} from 'lucide-react';

export interface TreeNodeExportFields {
  photo?: boolean;
  dates?: boolean;
  birthplace?: boolean;
  occupation?: boolean;
}

interface TreeNodeProps {
  node: TreeNodeType;
  onNodeClick: (node: TreeNodeType) => void;
  onAddChild?: (parentId: string) => void;
  onAddSpouse?: (personId: string) => void;
  onAddParent?: (childId: string) => void;
  onViewBirthFamily?: (personId: string, maidenName?: string) => void;
  expandedNodes: Set<string>;
  toggleExpanded: (nodeId: string) => void;
  level: number;
  isRoot?: boolean;
  readOnly?: boolean;
  exportMode?: boolean;
  exportFields?: TreeNodeExportFields;
  maxLevels?: number;
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
  exportMode = false,
  exportFields,
  maxLevels,
}: TreeNodeProps) {
  const treeView = useTreeViewOptional();
  const [branchMenuFor, setBranchMenuFor] = useState<string | null>(null);

  const exportLevelOk = typeof maxLevels !== 'number' || level + 1 < maxLevels;
  const hasChildren = Boolean(node.children?.length) && (!exportMode || exportLevelOk);
  const isExpanded = exportMode ? true : expandedNodes.has(node.id);
  const effectiveReadOnly = exportMode || readOnly;
  const showPhoto = exportMode ? exportFields?.photo !== false : true;
  const showDates = exportMode ? exportFields?.dates === true : true;

  const allSpouses = node.spouses || (node.spouse ? [node.spouse] : []);
  const hasMultipleSpouses = allSpouses.length > 1;

  const runAction = (action: ((id: string) => void) | undefined, personId: string) => {
    setBranchMenuFor(null);
    action?.(personId);
  };

  const PersonCard = ({
    person,
    spouse = false,
    marriageOrder,
    totalSpouses,
  }: {
    person: TreeNodeType | SpouseNode;
    spouse?: boolean;
    marriageOrder?: number;
    totalSpouses?: number;
  }) => {
    const menuOpen = branchMenuFor === person.id;
    const birthYear = person.attributes?.birthYear;
    const deathYear = person.attributes?.deathYear;
    const maidenName = spouse && person.attributes?.maidenName && person.attributes.maidenName !== person.lastName
      ? person.attributes.maidenName
      : null;
    const marriageLabel = marriageOrder && totalSpouses && totalSpouses > 1
      ? `${marriageOrder}${marriageOrder === 1 ? 'st' : marriageOrder === 2 ? 'nd' : marriageOrder === 3 ? 'rd' : 'th'}`
      : null;

    return (
      <div className="relative">
        <button
          type="button"
          data-clickable="true"
          onClick={(event) => {
            event.stopPropagation();
            if (treeView?.consumeIfSuppressClick()) return;
            onNodeClick(person);
          }}
          className={clsx(
            'relative flex min-h-[112px] min-w-[210px] items-center gap-3 rounded-xl border bg-gradient-to-br from-[#fffefa] to-[#fffaf5] px-4 py-3 text-left shadow-[0_8px_22px_-14px_rgba(67,43,31,0.32)] transition-all duration-200',
            'hover:-translate-y-0.5 hover:border-[#caa995] hover:shadow-[0_12px_28px_-14px_rgba(67,43,31,0.38)]',
            isRoot && !spouse ? 'border-maroon-500/70 ring-1 ring-maroon-500/10' : 'border-[#dfd2c6]'
          )}
        >
          {isRoot && !spouse && (
            <span className="absolute -top-2.5 left-4 rounded-md bg-maroon-500 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-white shadow-sm">
              Root
            </span>
          )}

          {person.isVerified === false && !exportMode && (
            <span
              className="absolute -left-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-[#fffdf9] text-amber-600 ring-1 ring-amber-300"
              title="Recently added — pending review"
              aria-label="Recently added"
            >
              <AlertCircle className="h-3 w-3" />
            </span>
          )}

          {spouse && marriageLabel && (
            <span className="absolute -right-2 -top-2 rounded-full bg-[#b68862] px-1.5 py-0.5 text-[8px] font-bold text-white">
              {marriageLabel}
            </span>
          )}

          {showPhoto && (
            <div className="relative shrink-0">
              <Avatar
                src={person.profileImage}
                name={person.name}
                size="lg"
                className="ring-4 ring-[#f3ebe4] shadow-sm"
              />
              {!exportMode && (
                <span
                  className={clsx(
                    'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#fffefa]',
                    person.isLiving ? 'bg-emerald-500' : 'bg-[#9d958f]'
                  )}
                  title={person.isLiving ? 'Living' : 'Deceased'}
                />
              )}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="font-serif text-[15px] font-semibold leading-tight text-[#382a24]">{person.firstName}</p>
            <p className="mt-0.5 font-serif text-[13px] text-[#66564d]">{person.lastName}</p>
            {showDates && birthYear && (
              <p className="mt-1.5 text-[10px] text-[#95877e]">
                {birthYear}{deathYear ? ` – ${deathYear}` : ' –'}
              </p>
            )}
            {spouse && 'marriageDate' in person && person.marriageDate && (
              <p className="mt-0.5 text-[9px] text-[#aa9d94]">m. {new Date(person.marriageDate).getFullYear()}</p>
            )}
            {maidenName && (
              <p className="mt-1 truncate text-[9px] italic text-[#9c7868]">née {maidenName}</p>
            )}
            {exportMode && exportFields?.occupation && person.attributes?.occupation && (
              <p className="mt-1 text-[9px] italic text-[#95877e]">{person.attributes.occupation}</p>
            )}
          </div>
        </button>

        {!effectiveReadOnly && (onAddChild || onAddSpouse || onAddParent) && (
          <div className="absolute -bottom-3 -right-3 z-40" data-clickable="true">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setBranchMenuFor((current) => current === person.id ? null : person.id);
              }}
              className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#fffdf9] bg-maroon-500 text-white shadow-md transition hover:bg-maroon-600"
              aria-label={`Add a family branch from ${person.firstName}`}
              title="Add family branch"
            >
              <Plus className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-10 z-50 w-40 overflow-hidden rounded-xl border border-[#dfd2c6] bg-[#fffdf9] p-1.5 shadow-xl">
                {onAddChild && (
                  <BranchAction icon={<UserPlus className="h-3.5 w-3.5" />} label="Add child" onClick={() => runAction(onAddChild, person.id)} />
                )}
                {onAddSpouse && (
                  <BranchAction icon={<Heart className="h-3.5 w-3.5" />} label="Add spouse" onClick={() => runAction(onAddSpouse, person.id)} />
                )}
                {onAddParent && (
                  <BranchAction icon={<Users className="h-3.5 w-3.5" />} label="Add parent" onClick={() => runAction(onAddParent, person.id)} />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3">
        <PersonCard person={node} />

        {allSpouses.map((spouse, index) => (
          <div key={spouse.id} className="flex items-center">
            <div className="flex items-center" aria-hidden>
              <span className="h-px w-6 bg-[#cbb7a5]" />
              <span className="mx-1 grid h-6 w-6 place-items-center rounded-full bg-[#fffdf9] text-maroon-500 ring-1 ring-[#ddcfc4]">
                <Heart className="h-3.5 w-3.5" fill="currentColor" />
                {hasMultipleSpouses && <span className="sr-only">Marriage {index + 1}</span>}
              </span>
              <span className="h-px w-6 bg-[#cbb7a5]" />
            </div>
            <PersonCard
              person={spouse}
              spouse
              marriageOrder={
                'marriageOrder' in spouse && typeof spouse.marriageOrder === 'number'
                  ? spouse.marriageOrder
                  : index + 1
              }
              totalSpouses={allSpouses.length}
            />
          </div>
        ))}
      </div>

      {hasChildren && (
        <div className="flex flex-col items-center">
          <span className="h-5 w-px bg-maroon-500/70" aria-hidden />

          {!exportMode && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleExpanded(node.id);
              }}
              className="z-10 grid h-8 w-8 place-items-center rounded-full border border-maroon-300/70 bg-[#fffdf9] text-maroon-600 shadow-sm transition hover:bg-[#fff6f0]"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? `Collapse ${node.firstName}'s descendants` : `Expand ${node.firstName}'s descendants`}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}

          {isExpanded && (
            <>
              <span className="h-4 w-px bg-maroon-500/70" aria-hidden />
              <div className="relative">
                {node.children!.length > 1 && (
                  <div className="absolute left-0 right-0 top-0 h-px bg-maroon-500/65" aria-hidden />
                )}
                <div className="flex items-start gap-10">
                  {node.children!.map((child) => (
                    <div key={child.id} className="flex flex-col items-center">
                      <span className="h-6 w-px bg-maroon-500/65" aria-hidden />
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
                        exportMode={exportMode}
                        exportFields={exportFields}
                        maxLevels={maxLevels}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BranchAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[#604b40] transition hover:bg-[#f7efe8] hover:text-maroon-700"
    >
      <span className="text-[#9a6b56]">{icon}</span>
      {label}
    </button>
  );
}
