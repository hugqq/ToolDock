import type { ToolSearchCandidate } from "../types/search.ts";

export function rankToolMatches(
  candidates: ToolSearchCandidate[],
  query: string,
  limit = 5,
): ToolSearchCandidate[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return candidates.slice(0, limit);

  return candidates
    .map((candidate, index) => {
      const name = candidate.name.toLocaleLowerCase();
      const description = candidate.description.toLocaleLowerCase();
      const score = name === needle
        ? 0
        : name.startsWith(needle)
          ? 1
          : name.includes(needle)
            ? 2
            : description.includes(needle)
              ? 3
              : -1;
      return { candidate, index, score };
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

export function moveSelection(index: number, direction: -1 | 1, count: number): number {
  if (count <= 0) return -1;
  return (index + direction + count) % count;
}

export function isLatestRequest(responseId: number, activeId: number): boolean {
  return responseId === activeId;
}
