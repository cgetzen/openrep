function uniqueBranchTitles(matches) {
  const seenIds = new Set();
  const seenTitles = new Set();
  const titles = [];

  for (const match of matches ?? []) {
    const line = match?.line;
    const title = line?.title;
    if (!title) continue;

    const id = line.id ?? null;
    if (id && seenIds.has(id)) continue;
    if (!id && seenTitles.has(title)) continue;

    if (id) seenIds.add(id);
    seenTitles.add(title);
    titles.push(title);
  }

  return titles;
}

export function summarizeExactBranchMatches(matches) {
  const titles = uniqueBranchTitles(matches);
  return {
    primaryTitle: titles[0] ?? null,
    moreTitles: titles.slice(1),
    titles
  };
}
