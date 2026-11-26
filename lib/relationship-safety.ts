/** A new parent -> child edge is invalid if the parent is already reachable from the child. */
export function wouldCreateAncestryCycle(parentId: string, childId: string, edges: readonly {parentId: string | null; childId: string | null}[]): boolean {
  const visited = new Set<string>();
  const queue = [childId];
  while (queue.length) {
    const id = queue.pop()!;
    if (id === parentId) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const edge of edges) if (edge.parentId === id && edge.childId && !visited.has(edge.childId)) queue.push(edge.childId);
  }
  return false;
}
