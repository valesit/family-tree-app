import type { TreeNode } from '@/types';

export type TreeTransform = { x: number; y: number; scale: number };
export type TreeBounds = { x: number; y: number; width: number; height: number };
export type TreeViewport = {
  width: number;
  height: number;
  contentWidth: number;
  contentHeight: number;
};

export const TREE_MIN_SCALE = 0.25;
export const TREE_MAX_SCALE = 2;
const FIT_PADDING = 24;
const READABLE_THRESHOLD = 0.76;

export function clampTreeScale(scale: number): number {
  return Math.max(TREE_MIN_SCALE, Math.min(TREE_MAX_SCALE, scale));
}

/**
 * The full-tree fit is always available as a deliberate action, even when the
 * whole family becomes too wide for readable text at that zoom level.
 */
export function fitWholeTree(viewport: TreeViewport): TreeTransform {
  const { width, height, contentWidth, contentHeight } = viewport;
  const availableWidth = Math.max(1, width - FIT_PADDING * 2);
  const availableHeight = Math.max(1, height - FIT_PADDING * 2);
  const scale = clampTreeScale(Math.min(1, availableWidth / contentWidth, availableHeight / contentHeight));

  return {
    x: (width - contentWidth * scale) / 2,
    y: (height - contentHeight * scale) / 2,
    scale,
  };
}

/** Pick a central family group for initial viewing, without modifying lineage. */
export function chooseTreeFocusId(root: TreeNode): string {
  let selectedId = root.id;
  let bestScore = -Infinity;

  const walk = (person: TreeNode, depth: number) => {
    const children = person.children?.length ?? 0;
    const spouses = person.spouses?.length ?? (person.spouse ? 1 : 0);
    // A group with many children is more useful as an initial focal point
    // than an ancestor whose descendants form a very wide row.
    const score = children * 10 + (spouses > 0 ? 6 : 0) - depth;
    if (score > bestScore) {
      bestScore = score;
      selectedId = person.id;
    }
    person.children?.forEach((child) => walk(child, depth + 1));
  };
  walk(root, 0);
  return selectedId;
}

function centeredAxis(
  viewSize: number,
  contentSize: number,
  zoom: number,
  centerPosition: number,
  focusPosition: number
): number {
  const scaledSize = contentSize * zoom;
  if (scaledSize <= viewSize) return (viewSize - scaledSize) / 2;
  const requested = viewSize * centerPosition - focusPosition * zoom;
  return Math.min(FIT_PADDING, Math.max(viewSize - scaledSize - FIT_PADDING, requested));
}

/**
 * Prefer visible names to showing every descendant at once. Center on the
 * family group with the most children when a complete fit would be tiny.
 * Users can still pan to other branches or press Fit to see the whole tree.
 */
export function preferredTreeView(
  viewport: TreeViewport,
  focus: TreeBounds | null
): TreeTransform {
  const fitted = fitWholeTree(viewport);
  if (fitted.scale >= READABLE_THRESHOLD || !focus) return fitted;

  const scale = viewport.width < 520 ? 0.82 : viewport.width < 900 ? 0.86 : 0.94;
  const focusX = focus.x + focus.width / 2;
  const focusY = focus.y + focus.height / 2;

  return {
    scale,
    x: centeredAxis(viewport.width, viewport.contentWidth, scale, 0.5, focusX),
    y: centeredAxis(viewport.height, viewport.contentHeight, scale, 0.45, focusY),
  };
}

/** Zoom towards the mouse / viewport center so people don't drift offscreen. */
export function zoomTreeAt(
  current: TreeTransform,
  nextScale: number,
  point: { x: number; y: number }
): TreeTransform {
  const scale = clampTreeScale(nextScale);
  const ratio = scale / current.scale;
  return {
    x: point.x - (point.x - current.x) * ratio,
    y: point.y - (point.y - current.y) * ratio,
    scale,
  };
}
