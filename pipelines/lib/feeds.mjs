/**
 * FEEDS — parse RSS 2.0 and Atom feeds into a uniform item list.
 * Uses fast-xml-parser; tolerant of real-world feed quirks.
 * Items: { title, url, published, summary }
 */
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => ['item', 'entry'].includes(name),
});

export function parseFeed(xml) {
  let doc;
  try {
    doc = parser.parse(xml);
  } catch {
    return { ok: false, items: [], error: 'unparseable XML' };
  }

  // RSS 2.0: rss > channel > item[]
  const channel = doc?.rss?.channel;
  if (channel?.item) {
    const items = channel.item
      .map((it) => ({
        title: str(it.title),
        url: str(it.link),
        published: str(it.pubDate ?? it['dc:date']),
        summary: stripHtml(str(it.description ?? '')),
      }))
      .filter((it) => it.title && it.url);
    return { ok: true, kind: 'rss', items };
  }

  // Atom: feed > entry[]
  const feed = doc?.feed;
  if (feed?.entry) {
    const items = feed.entry
      .map((en) => ({
        title: str(en.title),
        url: atomLink(en.link),
        published: str(en.published ?? en.updated),
        summary: stripHtml(str(en.summary ?? en.content ?? '')),
      }))
      .filter((it) => it.title && it.url);
    return { ok: true, kind: 'atom', items };
  }

  return { ok: false, items: [], error: 'no rss/atom root' };
}

function atomLink(link) {
  if (!link) return null;
  const arr = Array.isArray(link) ? link : [link];
  const alt = arr.find((l) => (l?.['@_rel'] ?? 'alternate') === 'alternate') ?? arr[0];
  return str(alt?.['@_href'] ?? alt);
}

function str(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return v['#text'] ? String(v['#text']).trim() : null;
  return String(v).trim();
}

export function stripHtml(html) {
  return String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
