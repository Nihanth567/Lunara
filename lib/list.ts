/**
 * The shared list — pure shape and rules.
 *
 * Everything here is a pure function over rows so that the same logic serves a
 * server-paired couple and a demo couple without a branch. `AppContext` owns
 * the fetching and the storage; this file owns what "done" means.
 */

/** A single check mark: one person, one item. */
export interface ListCheck {
  itemId: string;
  userId: string;
}

/** A list item as the app uses it — server rows and demo rows both land here. */
export interface ListItem {
  id: string;
  title: string;
  note: string;
  /** "Some tasks are only done when you both tick them." */
  needsBoth: boolean;
  /** Drives the author dot's colour. */
  createdByMe: boolean;
  checkedByMe: boolean;
  checkedByPartner: boolean;
  /** Derived by `isDone` — never stored. */
  done: boolean;
  position: number;
  createdAt: string;
}

/**
 * Whether an item counts as finished.
 *
 * The `partnerPaired` argument is the part that is easy to get wrong. A
 * both-must-tick item in a couple that has not paired yet would otherwise be
 * permanently un-completable: you tick it, nothing happens, and there is no
 * second person who could ever make it happen. While you are on your own, a
 * shared item behaves like a solo one; it re-arms the moment a partner joins.
 */
export function isDone(
  needsBoth: boolean,
  checkedByMe: boolean,
  checkedByPartner: boolean,
  partnerPaired: boolean,
): boolean {
  if (needsBoth && partnerPaired) return checkedByMe && checkedByPartner;
  return checkedByMe || checkedByPartner;
}

/**
 * Recompute `done` across a list. Call after any check or `needs_both` change
 * rather than patching the flag at each call site.
 */
export function withDoneState(items: ListItem[], partnerPaired: boolean): ListItem[] {
  return items.map((item) => ({
    ...item,
    done: isDone(item.needsBoth, item.checkedByMe, item.checkedByPartner, partnerPaired),
  }));
}

/**
 * Open items first, then completed — each keeping its own order.
 *
 * Sorting purely by `position` would make a ticked item stay put, which reads
 * as nothing having happened; sorting completed items to the bottom is the
 * movement that makes the tick feel like it landed. Completed items are ordered
 * by position too, not by when they were ticked, so the bottom of the list
 * doesn't reshuffle every time someone checks something.
 */
export function sortItems(items: ListItem[]): ListItem[] {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.position - b.position;
  });
}

/**
 * Where a new item goes: the end.
 *
 * Positions are sparse doubles and gaps are deliberate — inserting between two
 * items is a midpoint, so a reorder writes one row instead of renumbering the
 * list. Two people adding at the same moment can land on the same position;
 * ties fall back to whatever order the server returns, which is harmless.
 */
export function nextPosition(items: ListItem[]): number {
  if (items.length === 0) return 0;
  return Math.max(...items.map((i) => i.position)) + 1000;
}

/** Progress for the header. Counts every item, done or not. */
export function listProgress(items: ListItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length };
}
