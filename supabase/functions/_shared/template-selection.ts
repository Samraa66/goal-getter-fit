/**
 * Shared template selection: score by affinity + cuisine, deterministic tie-break.
 * Used by generate-weekly-meal-plan and optionally personalize-meal.
 */

export interface InsightsForSelection {
  avoided_foods?: string[] | null;
  favorite_cuisines?: string[] | null;
  template_affinity?: Record<string, number> | null;
}

/** Simple deterministic hash for tie-break (same seed + id => same bucket) */
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * Select one meal template from candidates: filter avoided, score by affinity + cuisine,
 * deterministic pick from top N for same seed.
 */
export function selectMealTemplate(
  candidates: any[],
  options: {
    usedTemplateIds: Set<string>;
    insights: InsightsForSelection | null | undefined;
    seed: string; // e.g. dateStr + slot for deterministic tie-break
    topN?: number;
  }
): any | null {
  if (!candidates || candidates.length === 0) return null;

  let pool = candidates.filter((t) => !options.usedTemplateIds.has(t.id));
  if (pool.length === 0) {
    options.usedTemplateIds.clear();
    pool = candidates;
  }

  const avoided = options.insights?.avoided_foods ?? [];
  if (avoided.length > 0) {
    const filtered = pool.filter((t: any) => {
      const name = (t.name || "").toLowerCase();
      const tags = ((t.tags as string[]) || []).map((x: string) => x.toLowerCase());
      return !avoided.some((a) => name.includes(String(a).toLowerCase()) || tags.some((tag) => tag.includes(String(a).toLowerCase())));
    });
    if (filtered.length > 0) pool = filtered;
  }

  const templateAffinity = options.insights?.template_affinity ?? {};
  const favoriteCuisines = options.insights?.favorite_cuisines ?? [];
  const hasScoring = Object.keys(templateAffinity).length > 0 || favoriteCuisines.length > 0;

  if (hasScoring) {
    pool = [...pool].sort((a: any, b: any) => {
      const scoreA = (templateAffinity[a.id] ?? 0) + (favoriteCuisines.some((c) => ((a.tags as string[]) || []).some((t: string) => t.toLowerCase().includes(String(c).toLowerCase()))) ? 0.3 : 0);
      const scoreB = (templateAffinity[b.id] ?? 0) + (favoriteCuisines.some((c) => ((b.tags as string[]) || []).some((t: string) => t.toLowerCase().includes(String(c).toLowerCase()))) ? 0.3 : 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (a.id || "").localeCompare(b.id || "");
    });
  } else {
    pool = [...pool].sort((a: any, b: any) => (a.id || "").localeCompare(b.id || ""));
  }

  const topN = options.topN ?? 5;
  const top = pool.slice(0, topN);
  if (top.length === 0) return null;
  const idx = hashSeed(options.seed) % top.length;
  return top[idx];
}
