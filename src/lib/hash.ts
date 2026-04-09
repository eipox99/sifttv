import { createHash } from "node:crypto";

export function filtersHash(input: Record<string, string | null | undefined>) {
  const normalized = Object.entries(input)
    .filter(([, value]) => value)
    .sort(([left], [right]) => left.localeCompare(right));

  return createHash("sha1").update(JSON.stringify(normalized)).digest("hex");
}
