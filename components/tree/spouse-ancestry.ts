import type { TreeNode } from '@/types';

export type AncestryDisplayMode = 'primary' | 'all';

/**
 * Only ancestry attached to spouses who marry into a non-principal household
 * is collapsed in the primary view. Direct descendants (including those with
 * different surnames) and the principal couple's two branches stay visible.
 * This changes presentation only, never the stored parent-child links.
 */
export function shouldCollapseSpouseAncestors(
  person: TreeNode,
  descendantNodeId: string,
  principalCoupleId: string | undefined,
  mode: AncestryDisplayMode
): boolean {
  return (
    mode === 'primary' &&
    person.id !== descendantNodeId &&
    descendantNodeId !== principalCoupleId &&
    Boolean(person.parents?.length)
  );
}

export type AncestorGeneration = { depth: number; people: TreeNode[] };

/** Group already-recorded ancestors without inventing links from surnames. */
export function collectAncestorGenerations(person: TreeNode): AncestorGeneration[] {
  const generations = new Map<number, TreeNode[]>();
  const visited = new Set([person.id]);
  let current: TreeNode[] = [person];

  for (let depth = 1; depth <= 10; depth++) {
    const parents: TreeNode[] = [];
    for (const child of current) {
      for (const parent of child.parents ?? []) {
        if (visited.has(parent.id)) continue;
        visited.add(parent.id);
        parents.push(parent);
      }
    }
    if (!parents.length) break;
    generations.set(depth, parents);
    current = parents;
  }

  return Array.from(generations, ([depth, people]) => ({ depth, people }))
    .sort((a, b) => b.depth - a.depth);
}
