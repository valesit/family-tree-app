'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { TreeNode as TreeNodeType, SpouseNode } from '@/types';
import { Avatar } from '@/components/ui';
import { clsx } from 'clsx';
import { useTreeViewOptional } from './TreeViewContext';
import {
  ChevronDown,
  ChevronRight,
  Crown,
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
  onSetRoot?: (personId: string) => void;
  rootPersonId?: string;
  onViewBirthFamily?: (personId: string, maidenName?: string) => void;
  expandedNodes: Set<string>;
  toggleExpanded: (nodeId: string) => void;
  level: number;
  isRoot?: boolean;
  readOnly?: boolean;
  exportMode?: boolean;
  exportFields?: TreeNodeExportFields;
  maxLevels?: number;
  incomingFromParent?: boolean;
}

type DisplayTreePerson = (TreeNodeType | SpouseNode) & {
  isNew?: boolean;
  parentIds?: string[];
};

type VisualPartner = {
  person: DisplayTreePerson;
  spouseCard: boolean;
  marriageOrder?: number;
};

export function TreeNode({
  node,
  onNodeClick,
  onAddChild,
  onAddSpouse,
  onAddParent,
  onSetRoot,
  rootPersonId,
  onViewBirthFamily,
  expandedNodes,
  toggleExpanded,
  level,
  isRoot = false,
  readOnly = false,
  exportMode = false,
  exportFields,
  maxLevels,
  incomingFromParent = false,
}: TreeNodeProps) {
  const treeView = useTreeViewOptional();
  const [branchMenuFor, setBranchMenuFor] = useState<string | null>(null);
  const nodeContainerRef = useRef<HTMLDivElement>(null);
  const canonicalCardRef = useRef<HTMLDivElement>(null);
  const [lineageAnchorPercent, setLineageAnchorPercent] = useState(50);

  const exportLevelOk = typeof maxLevels !== 'number' || level + 1 < maxLevels;
  const hasChildren = Boolean(node.children?.length) && (!exportMode || exportLevelOk);
  const isExpanded = exportMode ? true : expandedNodes.has(node.id);
  const effectiveReadOnly = exportMode || readOnly;
  const showPhoto = exportMode ? exportFields?.photo !== false : true;
  const showDates = exportMode ? exportFields?.dates === true : true;
  const effectiveRootPersonId = rootPersonId ?? (isRoot ? node.id : undefined);

  const defaultSetRoot = !effectiveReadOnly
    ? async (personId: string) => {
        const people = [node, ...(node.spouses || (node.spouse ? [node.spouse] : []))];
        const candidate = people.find((person) => person.id === personId);
        const candidateName = candidate ? `${candidate.firstName} ${candidate.lastName}` : 'this person';
        if (!window.confirm(`Set ${candidateName} as the root person for this family tree?`)) return;

        try {
          const response = await fetch('/api/family/root', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personId }),
          });
          const result = await response.json();
          if (!result.success) {
            window.alert(result.error || 'Failed to set the family root.');
            return;
          }

          const url = new URL(window.location.href);
          if (url.pathname.startsWith('/tree')) {
            url.searchParams.set('rootId', personId);
            window.location.assign(url.toString());
          } else {
            window.location.reload();
          }
        } catch (error) {
          console.error('Failed to set family root', error);
          window.alert('Failed to set the family root. Please try again.');
        }
      }
    : undefined;

  const effectiveSetRoot = onSetRoot ?? defaultSetRoot;
  const displayNode = node as DisplayTreePerson;
  const allSpouses = (node.spouses || (node.spouse ? [node.spouse] : [])) as DisplayTreePerson[];
  const hasMultipleSpouses = allSpouses.length > 1;

  /*
   * Keep the husband/father on the left when the data supports it. This is only
   * visual ordering: node remains the canonical person through whom the lineage
   * arrived, and the incoming connector is routed to node's own card below.
   */
  const maleSpouseIndex = node.gender === 'MALE'
    ? -1
    : allSpouses.findIndex((spouse) => spouse.gender === 'MALE');

  const visualAnchor: DisplayTreePerson =
    maleSpouseIndex >= 0 ? allSpouses[maleSpouseIndex] : displayNode;

  const visualPartners: VisualPartner[] = visualAnchor.id === node.id
    ? allSpouses.map((spouse, index) => ({
        person: spouse,
        spouseCard: true,
        marriageOrder:
          'marriageOrder' in spouse && typeof spouse.marriageOrder === 'number'
            ? spouse.marriageOrder
            : index + 1,
      }))
    : [
        {
          person: displayNode,
          spouseCard: true,
          marriageOrder:
            'marriageOrder' in visualAnchor && typeof visualAnchor.marriageOrder === 'number'
              ? visualAnchor.marriageOrder
              : 1,
        },
        ...allSpouses
          .filter((spouse) => spouse.id !== visualAnchor.id)
          .map((spouse, index) => ({
            person: spouse,
            spouseCard: true,
            marriageOrder:
              'marriageOrder' in spouse && typeof spouse.marriageOrder === 'number'
                ? spouse.marriageOrder
                : index + 2,
          })),
      ];

  /*
   * A child can be visually positioned on either side of their spouse. Measure
   * the canonical child's actual card position and route the incoming genealogy
   * line to that card. This prevents a line from ending at the marriage midpoint
   * and incorrectly suggesting that the spouse is also a child of the parents.
   */
  useLayoutEffect(() => {
    if (!incomingFromParent) return;
    const container = nodeContainerRef.current;
    const card = canonicalCardRef.current;
    if (!container || !card) return;

    const containerRect = container.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    if (!containerRect.width) return;

    const cardCenter = cardRect.left + cardRect.width / 2;
    const percentage = ((cardCenter - containerRect.left) / containerRect.width) * 100;
    setLineageAnchorPercent(Math.min(98, Math.max(2, percentage)));
  }, [incomingFromParent, node.id, visualAnchor.id, visualPartners.length, expandedNodes]);

  const routeStartPercent = Math.min(50, lineageAnchorPercent);
  const routeWidthPercent = Math.abs(lineageAnchorPercent - 50);

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
    person: DisplayTreePerson;
    spouse?: boolean;
    marriageOrder?: number;
    totalSpouses?: number;
  }) => {
    const menuOpen = branchMenuFor === person.id;
    const personIsRoot = effectiveRootPersonId === person.id;
    const birthYear = person.attributes?.birthYear;
    const deathYear = person.attributes?.deathYear;
    const maidenName = spouse && person.attributes?.maidenName && person.attributes.maidenName !== person.lastName
      ? person.attributes.maidenName
      : null;
    const marriageLabel = marriageOrder && totalSpouses && totalSpouses > 1
      ? `${marriageOrder}${marriageOrder === 1 ? 'st' : marriageOrder === 2 ? 'nd' : marriageOrder === 3 ? 'rd' : 'th'}`
      : null;

    return (
      <div
        ref={person.id === node.id ? canonicalCardRef : undefined}
        className="relative"
      >
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
            personIsRoot ? 'border-maroon-500/70 ring-1 ring-maroon-500/10' : 'border-[#dfd2c6]'
          )}
        >
          {personIsRoot && (
            <span className="absolute -top-2.5 left-4 rounded-md bg-maroon-500 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-white shadow-sm">
              Root
            </span>
          )}

          {person.isNew && !exportMode && (
            <span
              className="absolute -top-2.5 right-3 rounded-full border border-[#dfd2c6] bg-[#f5eee8] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-[#765f52] shadow-[0_2px_7px_rgba(74,46,32,0.06)]"
              title="Added within the last 30 days"
              aria-label="Added within the last 30 days"
            >
              New
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

        {!effectiveReadOnly && (onAddChild || onAddSpouse || onAddParent || effectiveSetRoot) && (
          <div className="absolute -bottom-3 -right-3 z-40" data-clickable="true">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setBranchMenuFor((current) => current === person.id ? null : person.id);
              }}
              className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#fffdf9] bg-maroon-500 text-white shadow-md transition hover:bg-maroon-600"
              aria-label={`Add or manage a family branch from ${person.firstName}`}
              title="Family branch actions"
            >
              <Plus className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-xl border border-[#dfd2c6] bg-[#fffdf9] p-1.5 shadow-xl">
                {onAddChild && (
                  <BranchAction icon={<UserPlus className="h-3.5 w-3.5" />} label="Add child" onClick={() => runAction(onAddChild, person.id)} />
                )}
                {onAddSpouse && (
                  <BranchAction icon={<Heart className="h-3.5 w-3.5" />} label="Add spouse" onClick={() => runAction(onAddSpouse, person.id)} />
                )}
                {onAddParent && (
                  <BranchAction icon={<Users className="h-3.5 w-3.5" />} label="Add parent" onClick={() => runAction(onAddParent, person.id)} />
                )}
                {effectiveSetRoot && effectiveRootPersonId !== person.id && (
                  <>
                    <div className="my-1 h-px bg-[#eee4dc]" />
                    <BranchAction icon={<Crown className="h-3.5 w-3.5" />} label="Set as family root" onClick={() => runAction(effectiveSetRoot, person.id)} />
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={nodeContainerRef} className="group/tree relative flex flex-col items-center">
      {incomingFromParent && (
        <div className="relative h-8 w-full min-w-[210px]" aria-hidden>
          <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-[#b58b6a]" />
          {routeWidthPercent > 0.25 && (
            <span
              className="absolute top-3 h-px bg-[#b58b6a]"
              style={{ left: `${routeStartPercent}%`, width: `${routeWidthPercent}%` }}
            />
          )}
          <span
            className="absolute bottom-0 top-3 w-px -translate-x-1/2 bg-[#b58b6a]"
            style={{ left: `${lineageAnchorPercent}%` }}
          />
          <ChevronDown
            className="absolute -bottom-1 h-3 w-3 -translate-x-1/2 text-[#9d6f55]"
            style={{ left: `${lineageAnchorPercent}%` }}
          />
        </div>
      )}

      {/* Husband/father can remain on the left, while lineage still terminates
          on the canonical child's own card. */}
      <div className="flex items-center gap-3">
        <PersonCard person={visualAnchor} />

        {visualPartners.map(({ person, spouseCard, marriageOrder }, index) => (
          <div key={person.id} className="flex items-center">
            <div className="flex items-center" aria-hidden>
              <span className="h-px w-8 bg-[#c8ae98]" />
              <span className="mx-1.5 grid h-7 w-7 place-items-center rounded-full bg-[#fffdf9] text-maroon-500 ring-1 ring-[#ddcfc4] shadow-[0_2px_8px_rgba(89,53,36,0.08)]">
                <Heart className="h-3.5 w-3.5" fill="currentColor" />
                {hasMultipleSpouses && <span className="sr-only">Marriage {index + 1}</span>}
              </span>
              <span className="h-px w-8 bg-[#c8ae98]" />
            </div>
            <PersonCard
              person={person}
              spouse={spouseCard}
              marriageOrder={marriageOrder}
              totalSpouses={allSpouses.length}
            />
          </div>
        ))}
      </div>

      {hasChildren && (
        <div className="flex flex-col items-center">
          {/* Keep the lineage trunk uninterrupted. The expand/collapse control
              sits just off the line so the tree reads like a traditional
              genealogy chart instead of an org-chart arrow. */}
          <div className="relative h-10 w-10">
            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[#b58b6a]" aria-hidden />
            {!exportMode && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleExpanded(node.id);
                }}
                className="absolute left-1/2 top-1/2 ml-2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full border border-[#ddcfc4] bg-[#fffdf9]/95 text-[#8b5f4c] shadow-sm opacity-60 transition hover:bg-white hover:opacity-100 md:opacity-0 md:group-hover/tree:opacity-100 focus:opacity-100"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? `Collapse ${node.firstName}'s descendants` : `Expand ${node.firstName}'s descendants`}
                title={isExpanded ? 'Collapse branch' : 'Expand branch'}
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>

          {isExpanded && (
            <div className="flex items-start">
              {node.children!.map((child, index) => {
                const childCount = node.children!.length;
                return (
                  <div key={child.id} className="relative flex flex-col items-center px-5">
                    {childCount > 1 && index > 0 && (
                      <span className="absolute left-0 top-0 h-px w-1/2 bg-[#b58b6a]" aria-hidden />
                    )}
                    {childCount > 1 && index < childCount - 1 && (
                      <span className="absolute right-0 top-0 h-px w-1/2 bg-[#b58b6a]" aria-hidden />
                    )}
                    <span className="h-7 w-px bg-[#b58b6a]" aria-hidden />
                    <TreeNode
                      node={child}
                      onNodeClick={onNodeClick}
                      onAddChild={onAddChild}
                      onAddSpouse={onAddSpouse}
                      onAddParent={onAddParent}
                      onSetRoot={effectiveSetRoot}
                      rootPersonId={effectiveRootPersonId}
                      onViewBirthFamily={onViewBirthFamily}
                      expandedNodes={expandedNodes}
                      toggleExpanded={toggleExpanded}
                      level={level + 1}
                      readOnly={readOnly}
                      exportMode={exportMode}
                      exportFields={exportFields}
                      maxLevels={maxLevels}
                      incomingFromParent
                    />
                  </div>
                );
              })}
            </div>
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
