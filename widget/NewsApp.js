// NewsApp – Scriptable Widget (CP1 + Profile, ohne KI)
// -----------------------------------------------------------------------------
// Profil: über den Widget-Parameter "max" oder "frau" (beim Widget-Einrichten
//   unter "Parameter" eintragen). Ohne Angabe: "max".
//
// Datenquelle (in dieser Reihenfolge):
//   1) lokale Datei "briefing-<profil>.json" im Scriptable-iCloud-Ordner
//      (Fallback: "briefing.json")
//   2) BRIEFING_URL (sobald gehostet – siehe ADR-0002 Backend-Hosting)
//
// Installation: App "Scriptable" (gratis) → dieses Skript hinzufügen →
//   Home-Screen → Widget "Scriptable" → dieses Skript wählen → ggf. Parameter setzen.
// -----------------------------------------------------------------------------

// Gehostetes Briefing (GitHub Pages). {profil} wird automatisch durch "max"/"frau" ersetzt.
const BRIEFING_URL = "https://maximilianbusch.github.io/newsapp/briefing-{profil}.json";

const CATEGORY_LABEL = {
  politik: "Politik",
  gesellschaft: "Gesellschaft",
  technik: "Technik",
  ki: "KI",
  basteln: "Basteln",
  kreativ: "Kreativ",
};
const CATEGORY_COLOR = {
  politik: "#f06a6a",
  gesellschaft: "#f0b24e",
  technik: "#57aef0",
  ki: "#9b8cf5",
  basteln: "#63d19a",
  kreativ: "#ef8fc0",
};
// Weniger Einträge + größere Schrift = besser lesbar
const MAX_ITEMS = { small: 3, medium: 4, large: 8, extraLarge: 10 };
const HEADLINE_SIZE = { small: 12, medium: 15, large: 16, extraLarge: 16 };

const PROFILE = (args.widgetParameter || "max").trim().toLowerCase() || "max";

async function loadBriefing() {
  // 1) gehostete URL (frische Daten) – bevorzugt, sobald konfiguriert
  if (BRIEFING_URL && !BRIEFING_URL.includes("DEIN-GITHUB-USER")) {
    try {
      const url = BRIEFING_URL.replace("{profil}", PROFILE);
      const req = new Request(url);
      req.timeoutInterval = 15;
      return await req.loadJSON();
    } catch (e) {
      /* weiter zur lokalen Datei */
    }
  }
  // 2) lokale Datei im iCloud-Scriptable-Ordner (Fallback / Offline-Test)
  try {
    const fm = FileManager.iCloud();
    for (const name of [`briefing-${PROFILE}.json`, "briefing.json"]) {
      const path = fm.joinPath(fm.documentsDirectory(), name);
      if (fm.fileExists(path)) {
        if (!fm.isFileDownloaded(path)) await fm.downloadFileFromiCloud(path);
        return JSON.parse(fm.readString(path));
      }
    }
  } catch (e) {
    /* fällt unten auf null */
  }
  return null;
}

// Kategorien abwechselnd durchgehen (nur für die Fallback-Datei mit categories-Map)
function interleave(categories, limit) {
  const keys = Object.keys(categories);
  const out = [];
  let row = 0;
  let progressed = true;
  while (out.length < limit && progressed) {
    progressed = false;
    for (const k of keys) {
      const item = categories[k]?.[row];
      if (item) {
        out.push({ ...item, category: k });
        progressed = true;
        if (out.length >= limit) break;
      }
    }
    row++;
  }
  return out;
}

// Liefert die anzuzeigenden Artikel – egal ob Profil-Datei (items[]) oder Fallback (categories{})
function getItems(data, limit) {
  if (!data) return [];
  if (Array.isArray(data.items)) return data.items.slice(0, limit);
  if (data.categories) return interleave(data.categories, limit);
  return [];
}

function formatAge(isoDate) {
  if (!isoDate) return "";
  const diffMin = Math.round((Date.now() - Date.parse(isoDate)) / 60000);
  if (!Number.isFinite(diffMin) || diffMin < 0) return "";
  if (diffMin < 60) return `${diffMin} min`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

function buildWidget(data, family) {
  const w = new ListWidget();
  w.backgroundColor = new Color("#0b0f14");
  w.setPadding(13, 15, 13, 15);

  // Kopfzeile
  const header = w.addStack();
  header.centerAlignContent();
  const title = header.addText("📰 NewsApp");
  title.font = Font.boldSystemFont(15);
  title.textColor = new Color("#ffffff");
  const label = data?.label ? " · " + data.label : "";
  if (label) {
    const l = header.addText(label);
    l.font = Font.systemFont(13);
    l.textColor = new Color("#8a97a6");
  }
  header.addSpacer();
  if (data?.generatedAt) {
    const age = formatAge(data.generatedAt);
    const upd = header.addText(age ? "vor " + age : "");
    upd.font = Font.systemFont(11);
    upd.textColor = new Color("#7a8694");
  }
  w.addSpacer(9);

  if (!data) {
    const msg = w.addText(
      `Kein Briefing (Profil "${PROFILE}") gefunden.\nbriefing-${PROFILE}.json in den Scriptable-iCloud-Ordner legen oder BRIEFING_URL setzen.`
    );
    msg.font = Font.systemFont(12);
    msg.textColor = new Color("#e0765a");
    return w;
  }

  const limit = MAX_ITEMS[family] || 4;
  const items = getItems(data, limit);
  const size = HEADLINE_SIZE[family] || 15;

  items.forEach((it, i) => {
    if (i > 0) w.addSpacer(family === "small" ? 6 : 8);
    const row = w.addStack();
    row.layoutVertically();

    const meta = row.addStack();
    meta.centerAlignContent();
    const dot = meta.addText("●");
    dot.font = Font.systemFont(9);
    dot.textColor = new Color(CATEGORY_COLOR[it.category] || "#888888");
    meta.addSpacer(5);
    const cat = meta.addText((CATEGORY_LABEL[it.category] || it.category).toUpperCase());
    cat.font = Font.mediumSystemFont(9);
    cat.textColor = new Color("#8a97a6");
    const age = formatAge(it.isoDate);
    if (age) {
      meta.addSpacer();
      const a = meta.addText(age);
      a.font = Font.systemFont(9);
      a.textColor = new Color("#5b6470");
    }
    row.addSpacer(2);

    const line = row.addText(it.title);
    line.font = Font.semiboldSystemFont(size);
    line.textColor = new Color("#eef2f6");
    line.lineLimit = 2;
    line.minimumScaleFactor = 0.9;
  });

  // Tap öffnet den ersten Artikel (Home-Screen-Widget = ein Tap-Ziel)
  if (items[0]?.link) w.url = items[0].link;
  return w;
}

const data = await loadBriefing();
const family = config.widgetFamily || "medium";
const widget = buildWidget(data, family);

// Wunsch an iOS: in ~30 Min neu laden (iOS entscheidet letztlich selbst).
widget.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  if (family === "small") await widget.presentSmall();
  else if (family === "large") await widget.presentLarge();
  else await widget.presentMedium();
}
Script.complete();
