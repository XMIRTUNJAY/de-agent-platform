/**
 * POPULARITY — 0-100 score from transparent inputs only:
 *
 * - github:     0-100 community sub-score from GitHub enrichment
 *               (stars/forks/watchers, log-normalized, official API)
 * - rating:     1-5 user votes stored in our own DB (one vote per voter per resource)
 * - engagement: our own first-party counters (install clicks, copy clicks, detail views)
 *
 * Deliberately no Google Trends or scraper signals: no official API exists and
 * scraping violates ToS. Every input above is either our own data or an official API.
 *
 * Rating slice falls back to the GitHub signal when a resource has no votes yet,
 * so unrated resources are ranked by real adoption instead of an arbitrary neutral.
 */
export const POPULARITY_WEIGHTS = { github: 0.5, rating: 0.3, engagement: 0.2 };

const clamp100 = (v) => Math.max(0, Math.min(100, Number(v) || 0));

export function computePopularity({
  community = 0,
  ratingAvg = 0,
  ratingCount = 0,
  installs = 0,
  copies = 0,
  views = 0,
} = {}) {
  const github = clamp100(community);
  const confidence = Math.min(Math.max(0, ratingCount), 10) / 10;
  const ratingPart =
    ratingCount > 0 ? ((ratingAvg / 5) * 100) * confidence + github * (1 - confidence) : github;
  const engagement = Math.min(100, Math.log10(1 + installs + copies + views) * 40);
  return Math.round((github * POPULARITY_WEIGHTS.github +
    clamp100(ratingPart) * POPULARITY_WEIGHTS.rating +
    engagement * POPULARITY_WEIGHTS.engagement) * 10) / 10;
}
