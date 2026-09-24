// ميزان البناء — تحديث الأسعار اليومي (بيشتغل على GitHub Actions، من غير أي تدخل)
// 1) يدوّر على نشرات أسعار الحديد والأسمنت في مصر المنشورة النهارده  2) يستخرج الأرقام  3) يراجعها بحدود أمان
// 4) يكتب data/current.json و prices.js — لو فيه تغيير بيطبع CHANGED=1
import fs from "node:fs";
const TODAY = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10); // Asia/Dubai
const cur = JSON.parse(fs.readFileSync("data/current.json", "utf8"));
const ovr = JSON.parse(fs.readFileSync("data/overrides.json", "utf8"));
const UA = {"user-agent": "Mozilla/5.0 (MizanPriceBot; +https://www.youtube.com/@reality-engineer)"};
const LOGS = [];
const log = (...a) => { const s = a.map(x => typeof x === "string" ? x : JSON.stringify(x)).join(" "); LOGS.push(s); console.log(s); };

import {toNum, text, parseSteel, parseCement} from "./parse.mjs";
async function get(url) {
  const r = await fetch(url, {headers: UA, redirect: "follow", signal: AbortSignal.timeout(20000)});
  if (!r.ok) throw new Error(r.status + " " + url); return r.text();
}
const FEEDS = [
  q => "https://www.bing.com/news/search?format=rss&setlang=ar&cc=EG&q=" + encodeURIComponent(q),
  q => "https://news.google.com/rss/search?hl=ar&gl=EG&ceid=EG:ar&q=" + encodeURIComponent(q + " when:2d"),
];
const unesc = s => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
// روابط جوجل وبينج بتبقى لفة على المقال — نطلع اللينك الحقيقي
function realLink(u) {
  u = unesc(u || "");
  const g = u.match(/news\.google\.com\/rss\/articles\/([A-Za-z0-9_-]+)/);
  if (g) {
    try {
      const raw = Buffer.from(g[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("latin1");
      const h = raw.match(/https?:\/\/[^\s\x00-\x1f"'<>]{12,}/);
      if (h) return h[0];
    } catch (e) {}
    return "";
  }
  return u;
}
function rssItems(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(x => ({
    link: realLink(((x[1].match(/<link>([^<]*)<\/link>/) || [])[1] || "").trim()),
    title: (x[1].match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || "",
    date: new Date((x[1].match(/<pubDate>([^<]+)<\/pubDate>/) || [])[1] || 0)}));
}
async function news(q, extra = []) {
  const out = [];
  const queries = [q, ...extra];
  for (const mk of FEEDS) for (const qq of queries) {
    const url = mk(qq);
    try {
      const xml = await get(url);
      const items = rssItems(xml).filter(i => i.link && (!+i.date || Date.now() - i.date < 48 * 3600e3));
      log(`feed ok (${items.length} items) ${new URL(url).host} -> ${[...new Set(items.map(i => { try { return new URL(i.link).host; } catch (e) { return "?"; } }))].join(", ").slice(0, 120)}`);
      out.push(...items);
      if (out.length >= 8) break;
    } catch (e) { log(`feed failed ${new URL(url).host}: ${e.message}`); }
  }
  const seen = new Set();
  return out.filter(i => !seen.has(i.link) && seen.add(i.link)).slice(0, 10);
}
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

async function egypt() {
  const res = {};
  // الحديد: متوسط 6 شركات رئيسية من أكتر من مقال
  try {
    const per = {};
    for (const it of await news("أسعار الحديد اليوم عز بشاي الجارحي", ["سعر الحديد اليوم في مصر الطن", "أسعار الحديد والأسمنت اليوم"])) {
      try { const p = parseSteel(text(await get(it.link))); log("steel article " + Object.keys(p).length + " hits: " + it.link.slice(0, 90)); if (Object.keys(p).length >= 3) for (const [k, v] of Object.entries(p)) (per[k] = per[k] || []).push(v); } catch (e) { log("skip", e.message); }
    }
    const vals = Object.entries(per).map(([k, a]) => [k, median(a)]);
    if (vals.length >= 4) {
      const avg = Math.round(vals.reduce((s, [, v]) => s + v, 0) / vals.length / 50) * 50;
      const list = vals.map(([k, v]) => k + " " + v.toLocaleString("en-US")).join(" · ");
      const en = {"عز": "Ezz", "بشاي": "Beshay", "السويس": "Suez", "الجارحي": "El Garhy", "المصريين": "Egyptian Steel", "المراكبي": "El Marakby"};
      res.steel = {v: avg, src_ar: "نشرات " + TODAY + ": " + list, src_en: "Bulletins " + TODAY + ": " + vals.map(([k, v]) => en[k] + " " + v.toLocaleString("en-US")).join(" · ")};
    } else log("steel: not enough companies", JSON.stringify(per));
  } catch (e) { log("steel failed", e.message); }
  // الأسمنت: وسيط المتوسطات المنشورة
  try {
    const all = [];
    for (const it of await news("سعر الأسمنت اليوم متوسط الطن", ["أسعار الأسمنت اليوم في مصر"])) { try { const cc = parseCement(text(await get(it.link))); log("cement article " + cc.length + " hits: " + it.link.slice(0, 90)); all.push(...cc); } catch (e) { log("skip", e.message); } }
    if (all.length >= 2) { const v = Math.round(median(all) / 50) * 50; res.cement = {v, src_ar: "نشرات " + TODAY + ": متوسط الطن ~" + v.toLocaleString("en-US"), src_en: "Bulletins " + TODAY + ": average ~" + v.toLocaleString("en-US") + " per ton"}; }
    else log("cement: not enough data", all);
  } catch (e) { log("cement failed", e.message); }
  return res;
}

// حدود الأمان: أقصى تغيير يومي 8% (الحديد والأسمنت)، والتعديلات اليدوية لحد 25%
function guard(c, k, n, maxPct) {
  const o = cur[c] && cur[c][k]; if (!o) return false;
  const d = Math.abs(n.v - o.v) / o.v;
  if (!(n.v > 0) || d > maxPct) { log(`REJECT ${c}.${k}: ${o.v} -> ${n.v} (${(d * 100).toFixed(1)}%)`); return false; }
  return true;
}
const auto = process.env.MIZAN_OFFLINE ? {} : await egypt();
let checked = false, changed = false;
for (const [k, n] of Object.entries(auto)) if (guard("EG", k, n, 0.08)) { checked = true; if (cur.EG[k].v !== n.v) changed = true; cur.EG[k] = n; }
for (const c of ["EG", "AE", "SA"]) for (const [k, n] of Object.entries(ovr[c] || {})) {
  if (guard(c, k, n, 0.25) && (cur[c][k].v !== n.v || cur[c][k].src_ar !== n.src_ar)) { cur[c][k] = {...cur[c][k], ...n}; changed = true; checked = true; }
}
if (checked && cur.date !== TODAY) { cur.date = TODAY; changed = true; }
if (changed) {
  fs.writeFileSync("data/current.json", JSON.stringify(cur, null, 1));
  fs.writeFileSync("prices.js", "/* ميزان البناء — نشرة الأسعار اليومية · Reality Engineer */\nwindow.MIZAN_LIVE=" + JSON.stringify(cur) + ";\n");
}
log("CHANGED=" + (changed ? 1 : 0), "date=" + cur.date, "auto=" + Object.keys(auto).join(","));
fs.writeFileSync("data/last-run.log", new Date().toISOString() + "\n" + LOGS.join("\n") + "\n");
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, "changed=" + (changed ? 1 : 0) + "\n");
