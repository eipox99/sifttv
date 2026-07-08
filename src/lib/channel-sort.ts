export type ChannelSortKey = "viewers_desc" | "viewers_asc" | "name";

export const DEFAULT_CHANNEL_SORT: ChannelSortKey = "viewers_desc";

// Sorts channel-like items. `getViewers` should return a number for live channels
// and null/undefined for offline ones, which are always grouped last (by name).
export function sortChannels<T>(
  items: T[],
  key: ChannelSortKey,
  getName: (item: T) => string,
  getViewers: (item: T) => number | null | undefined
): T[] {
  const sorted = [...items];

  const byName = (a: T, b: T) => getName(a).localeCompare(getName(b), undefined, { sensitivity: "base" });

  sorted.sort((a, b) => {
    const va = getViewers(a);
    const vb = getViewers(b);
    const aLive = typeof va === "number";
    const bLive = typeof vb === "number";

    // Live channels always come before offline ones, regardless of sort key.
    if (aLive !== bLive) {
      return aLive ? -1 : 1;
    }

    // Within the same group: name sort, or offline group, is alphabetical.
    if (key === "name" || !aLive) {
      return byName(a, b);
    }

    return key === "viewers_asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });

  return sorted;
}
