// NewsApp – Briefing-Builder (CP1 + Profile aus CP3, ohne KI)
// Lädt kuratierte RSS/Atom-Feeds, dedupliziert, sorgt für Quellen-Vielfalt
// (Anti-Filterblase) und schreibt pro Profil ein kompaktes Briefing-JSON.
//
// Nutzung:  node build_briefing.mjs
// Ausgabe:  briefing/briefing.json        (alle Kategorien, Fallback/Debug)
//           briefing/briefing-max.json    (Profil Max)
//           briefing/briefing-frau.json   (Profil Frau)

import Parser from "rss-parser";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const POOL_PER_CATEGORY = 12;  // wie viele Artikel je Kategorie vorgehalten werden
const SNIPPET_LEN = 240;       // max. Länge der Kurzbeschreibung

const parser = new Parser({
  timeout: 20000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) NewsApp/0.1",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
  },
});

const here = (p) => new URL(p, import.meta.url);

function normTitle(t) {
  return (t || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function timestamp(item) {
  const raw = item.isoDate || item.pubDate || null;
  const ms = raw ? Date.parse(raw) : NaN;
  return Number.isNaN(ms) ? 0 : ms;
}

async function fetchFeed(category, feed) {
  try {
    const parsed = await parser.parseURL(feed.url);
    return (parsed.items || [])
      .map((it) => ({
        title: (it.title || "").trim(),
        link: (it.link || "").trim(),
        source: feed.name,
        category,
        sprache: feed.sprache || "de",
        isoDate: it.isoDate || it.pubDate || null,
        snippet: (it.contentSnippet || it.summary || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, SNIPPET_LEN),
      }))
      .filter((x) => x.title && x.link);
  } catch (err) {
    console.warn(`  ⚠︎  Feed fehlgeschlagen [${category}/${feed.name}]: ${err.message}`);
    return [];
  }
}

// Round-Robin über die Quellen → keine Quelle dominiert (Vielfalt/Anti-Filterblase)
function diversify(items, limit) {
  const bySource = new Map();
  for (const it of items) {
    if (!bySource.has(it.source)) bySource.set(it.source, []);
    bySource.get(it.source).push(it);
  }
  for (const arr of bySource.values()) arr.sort((a, b) => timestamp(b) - timestamp(a));

  const out = [];
  let progressed = true;
  while (out.length < limit && progressed) {
    progressed = false;
    for (const arr of bySource.values()) {
      if (arr.length) {
        out.push(arr.shift());
        progressed = true;
        if (out.length >= limit) break;
      }
    }
  }
  return out;
}

// Aus den Kategorie-Pools ein Profil zusammenstellen (Reihenfolge + Anzahl je Kategorie)
function buildProfile(pools, profile) {
  const items = [];
  for (const cat of profile.order) {
    const n = profile.itemsPerCategory?.[cat] ?? 0;
    if (n > 0 && pools[cat]) items.push(...pools[cat].slice(0, n));
  }
  return items;
}

async function main() {
  const { categories } = JSON.parse(await readFile(here("./feeds.json"), "utf8"));
  const { profiles } = JSON.parse(await readFile(here("./profiles.json"), "utf8"));

  // 1) Pro Kategorie einen deduplizierten, quellenvielfältigen Pool bauen
  const pools = {};
  for (const [category, feeds] of Object.entries(categories)) {
    const collected = (await Promise.all(feeds.map((f) => fetchFeed(category, f)))).flat();

    const seen = new Set();
    const unique = [];
    for (const it of collected.sort((a, b) => timestamp(b) - timestamp(a))) {
      const tKey = "t:" + normTitle(it.title);
      const lKey = "l:" + it.link;
      if (seen.has(tKey) || seen.has(lKey)) continue;
      seen.add(tKey);
      seen.add(lKey);
      unique.push(it);
    }

    pools[category] = diversify(unique, POOL_PER_CATEGORY);
    console.log(
      `  ${category.padEnd(13)} ${feeds.length} Feeds → ${collected.length} Artikel → ${unique.length} eindeutig → Pool ${pools[category].length}`
    );
  }

  const generatedAt = new Date().toISOString();
  await mkdir(here("./briefing/"), { recursive: true });

  // 2) Fallback-/Debug-Datei mit allen Kategorien
  const combined = { generatedAt, version: "0.2", categories: {} };
  for (const [cat, pool] of Object.entries(pools)) combined.categories[cat] = pool.slice(0, 6);
  await writeFile(here("./briefing/briefing.json"), JSON.stringify(combined, null, 2) + "\n");

  // 3) Pro Profil eine Datei
  console.log("");
  for (const [key, profile] of Object.entries(profiles)) {
    if (key.startsWith("_")) continue;
    const items = buildProfile(pools, profile);
    const out = { generatedAt, version: "0.2", profile: key, label: profile.label, items };
    await writeFile(here(`./briefing/briefing-${key}.json`), JSON.stringify(out, null, 2) + "\n");
    const mix = profile.order
      .map((c) => `${c} ${items.filter((i) => i.category === c).length}`)
      .join(", ");
    console.log(`  Profil ${profile.label.padEnd(5)} → ${items.length} Artikel (${mix})`);
  }

  console.log(`\n✅ Briefings geschrieben  (${new Date().toLocaleString("de-DE")})`);
}

main().catch((err) => {
  console.error("Fehler:", err);
  process.exit(1);
});
