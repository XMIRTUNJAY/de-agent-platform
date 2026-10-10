// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { existsSync, readFileSync } from 'node:fs';

import { SITE } from './src/site.config.ts';

// Publishing states computed by the pipeline (ELIGIBILITY step). Only
// `eligible` pages belong in the sitemap; needs_review/internal_only stay
// browsable but uncrawled. Missing file (pre-pipeline runs) keeps old behavior.
let pageStates = {};
try {
  if (existsSync('./src/data/generated/page-eligibility.json')) {
    pageStates = JSON.parse(readFileSync('./src/data/generated/page-eligibility.json', 'utf8')).states ?? {};
  }
} catch { pageStates = {}; }
const strip = (u) => String(u).replace(/\/+$/, '') || '/';

// https://astro.build/config
export default defineConfig({
  site: SITE.url,
  trailingSlash: 'ignore',
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => {
        if (page.includes('/admin') || page.includes('/search')) return false;
        const hit = Object.entries(pageStates).find(([url]) => strip(url) === strip(new URL(page).pathname));
        if (hit) return hit[1] === 'eligible';
        return true;
      },
      changefreq: 'weekly',
      priority: 0.6,
    }),
  ],
  vite: {
    plugins: [/** @type {any} */ (tailwindcss())],
  },
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-default' },
      defaultColor: false,
      wrap: false,
    },
  },
  build: {
    inlineStylesheets: 'auto',
  },
  devToolbar: { enabled: false },
});
