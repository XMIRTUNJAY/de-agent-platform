---
layout: '@/layouts/DocsLayout.astro'
title: 'Measurement'
description: 'How DE//AGENT measures content quality, search, engagement, and revenue — and what it deliberately does not collect.'
kicker: 'Docs · Project'
---

A mature site needs more than a page count. Five metric groups tell us whether the platform is becoming a business — and the same honesty rules that govern content govern measurement.

## Metric groups

| Group | What to measure |
|---|---|
| Content quality | Share of pages with meaningful explanations, working links, and sufficient evidence (`depth.json`, link audit, eligibility states) |
| Search | Indexed pages, impressions, clicks, click-through rate, query coverage (Search Console) |
| Engagement | Search usage, related-page navigation, guide completion, return visits where measurable |
| Monetization | Affiliate clicks, conversion rate where reported, commission per click, revenue |
| Maintenance | Broken links, stale resources, review backlog, time to publish a quality page |

## The revenue arithmetic

Revenue equals relevant visits times affiliate click rate times purchase conversion times average commission. As an illustration only — not a forecast — 10,000 relevant visits at a 5% click rate, 2% conversion, and ₹1,000 average commission is ₹10,000/month. Commissions, conversion, attribution, and eligibility vary considerably; traffic quality and purchase intent matter far more than URL count.

## On-site hooks

- Every page ships a bounded in-memory outbound-click log (`window.__DE_OUTBOUND__`, last 100 clicks, no network, no cookies). It exists for debugging and for a future beacon — today it sends nothing anywhere.
- Privacy-friendly analytics (Plausible or Umami) can be enabled without code changes: set `ANALYTICS` in `src/site.config.ts` with the provider, domain, and script URL. While `provider` is null, zero third-party requests ship — verify this in your browser's network panel any time.

## What is not collected

No cookies, no fingerprinting, no cross-site tracking, no session replay. Anything beyond aggregate, consented analytics would need its own policy update and disclosure first.
