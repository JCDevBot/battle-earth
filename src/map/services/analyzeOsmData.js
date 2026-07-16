export function analyzeOsmData(osmData, limit = 50) {
  const counts = {};

  for (const element of osmData.elements ?? []) {
    if (!element.tags) continue;

    for (const [key, value] of Object.entries(element.tags)) {
      const tag = `${key}=${value}`;
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}
