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
