/**
 * Moves `itemId` so it ends up immediately before `insertBeforeIndex` in the result
 * (`0` = first, `orderedIds.length` = after last). Returns null when unchanged or `itemId` is missing.
 */
export function moveItemIdToInsertBefore(
  orderedIds: readonly string[],
  itemId: string,
  insertBeforeIndex: number,
): string[] | null {
  const fromIdx = orderedIds.indexOf(itemId);
  if (fromIdx === -1) {
    return null;
  }
  const n = orderedIds.length;
  const clamped = Math.max(0, Math.min(Math.floor(insertBeforeIndex), n));
  let insertAt = clamped;
  if (fromIdx < clamped) {
    insertAt -= 1;
  }
  const next = [...orderedIds];
  const [removed] = next.splice(fromIdx, 1);
  if (removed !== itemId) {
    return null;
  }
  next.splice(insertAt, 0, removed);
  const unchanged = next.length === orderedIds.length && next.every((id, i) => id === orderedIds[i]);
  return unchanged ? null : next;
}
