function levDist(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

function chars(s: string): Set<string> {
  return new Set(s.split(""));
}

export function rankScore(query: string, name: string): number {
  const q = query.toLowerCase();
  const n = name.toLowerCase();

  if (q === n) return 1_000_000;
  if (n.startsWith(q)) return 500_000;
  if (q.startsWith(n)) return 300_000;
  if (n.includes(q)) return 200_000;

  const qChars = chars(q);
  const nChars = chars(n);

  let allQinN = true, allNinQ = true;
  for (const c of qChars) if (!nChars.has(c)) { allQinN = false; break; }
  for (const c of nChars) if (!qChars.has(c)) { allNinQ = false; break; }

  let score = 0;

  if (allNinQ && q.length <= n.length + 2) score += 100_000;
  if (allQinN && n.length <= q.length + 2) score += 80_000;

  let commonSeq = 0;
  let qi = 0, ni = 0;
  while (qi < q.length && ni < n.length) {
    if (q[qi] === n[ni]) { commonSeq++; qi++; ni++; }
    else { ni++; }
  }
  score += commonSeq * 1000;

  score -= Math.abs(q.length - n.length) * 500;
  score -= levDist(q, n) * 200;

  return score;
}

export function rankSearchResults<T>(
  query: string,
  items: T[],
  getName: (item: T) => string
): T[] {
  if (!query) return items;
  const scored = items.map((item) => ({ item, score: rankScore(query, getName(item)) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}
