// ميزان البناء — تحديث الأسعار اليومي (بيشتغل على GitHub Actions، من غير أي تدخل)
// بيقرا نشرات الأسعار المنشورة، يستخرج أسعار مصانع الحديد في مصر والإمارات والسعودية + متوسط الأسمنت في مصر،
// يراجعها بحدود أمان، ويكتب data/current.json و prices.js. لو فيه تغيير بيطبع CHANGED=1
import fs from "node:fs";
import {text, parseBrands, parseCement, EN_BRAND} from "./parse.mjs";
const TODAY = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10); // Asia/Dubai
const cur = JSON.parse(fs.readFileSync("data/current.json", "utf8"));
const ovr = JSON.parse(fs.readFileSync("data/overrides.json", "utf8"));
const UA = {"user-agent": "Mozilla/5.0 (MizanPriceBot; +https://www.youtube.com/@reality-engineer)"};
const LOGS = [];
const log = (...a) => { const s = a.map(x => typeof x === "string" ? x : JSON.stringify(x)).join(" "); LOGS.push(s); console.log(s); };

async function get(url) {
  const r = await fetch(url, {headers: UA, redirect: "follow", signal: AbortSignal.timeout(20000)});
  if (!r.ok) throw new Error(r.status + " " + url); return r.text();
}
const FEEDS = [
  q => "https://www.bing.com/news/search?format=rss&setlang=ar&cc=EG&q=" + encodeURIComponent(q),
  q => "https://news.google.com/rss/search?hl=ar&gl=EG&ceid=EG:ar&q=" + encodeURIComponent(q + " when:3d"),
];
const unesc = s => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
function realLink(u) {                       // روابط جوجل وبينج لفة على المقال
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
const rssItems = xml => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(x => ({
  link: realLink(((x[1].match(/<link>([^<]*)<\/link>/) || [])[1] || "").trim()),
  date: new Date((x[1].match(/<pubDate>([^<]+)<\/pubDate>/) || [])[1] || 0)}));
async function news(queries, maxAgeH = 48) {
  const out = [];
  for (const mk of FEEDS) for (const q of queries) {
    const url = mk(q);
    try {
      const items = rssItems(await get(url)).filter(i => i.link && (!+i.date || Date.now() - i.date < maxAgeH * 3600e3));
      log(`feed ${new URL(url).host} (${items.length}) -> ${[...new Set(items.map(i => { try { return new URL(i.link).host; } catch (e) { return "?"; } }))].join(", ").slice(0, 110)}`);
      out.push(...items);
      if (out.length >= 10) break;
    } catch (e) { log(`feed failed ${new URL(url).host}: ${e.message}`); }
  }
  const seen = new Set();
  return out.filter(i => !seen.has(i.link) && seen.add(i.link)).slice(0, 12);
}
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

// أسعار الحديد في سوق واحد: متوسط المصانع × معامل (ضريبة + توريد)
async function steelOf(c, queries, factor, minBrands, maxAgeH) {
  const per = {};
  for (const it of await news(queries, maxAgeH)) {
    try {
      const p = parseBrands(text(await get(it.link)), c);
      log(`${c} article ${Object.keys(p).length} hits: ${it.link.slice(0, 80)}`);
      if (Object.keys(p).length >= 2) for (const [k, v] of Object.entries(p)) (per[k] = per[k] || []).push(v);
    } catch (e) { log(`${c} skip: ${e.message.slice(0, 60)}`); }
  }
  const vals = Object.entries(per).map(([k, a]) => [k, median(a)]);
  if (vals.length < minBrands) { log(`${c} steel: not enough mills`, JSON.stringify(per)); return null; }
  const avg = vals.reduce((s, [, v]) => s + v, 0) / vals.length * factor;
  const v = Math.round(avg / (c === "EG" ? 50 : 10)) * (c === "EG" ? 50 : 10);
  const ar = vals.map(([k, x]) => k + " " + x.toLocaleString("en-US")).join(" · ");
  const en = vals.map(([k, x]) => (EN_BRAND[k] || k) + " " + x.toLocaleString("en-US")).join(" · ");
  return {v, src_ar: `نشرات ${TODAY}: ${ar}`, src_en: `Bulletins ${TODAY}: ${en}`};
}
async function cementEG() {
  const all = [];
  for (const it of await news(["سعر الأسمنت اليوم متوسط الطن", "أسعار الأسمنت اليوم في مصر"])) {
    try { const cc = parseCement(text(await get(it.link))); log(`cement ${cc.length} hits: ${it.link.slice(0, 80)}`); all.push(...cc); } catch (e) { log("cement skip: " + e.message.slice(0, 60)); }
  }
  if (all.length < 2) { log("cement: not enough data", all); return null; }
  const v = Math.round(median(all) / 50) * 50;
  return {v, src_ar: `نشرات ${TODAY}: متوسط الطن ~${v.toLocaleString("en-US")}`, src_en: `Bulletins ${TODAY}: average ~${v.toLocaleString("en-US")} per ton`};
}

// حدود الأمان لكل سوق: مصر يومية (8%)، الخليج شهرية (12%)
function guard(c, k, n, maxPct) {
  const o = cur[c] && cur[c][k]; if (!o || !n) return false;
  const d = Math.abs(n.v - o.v) / o.v;
  if (!(n.v > 0) || d > maxPct) { log(`REJECT ${c}.${k}: ${o.v} -> ${n.v} (${(d * 100).toFixed(1)}%)`); return false; }
  return true;
}
const auto = {EG: {}, AE: {}, SA: {}};
if (!process.env.MIZAN_OFFLINE) {
  try { auto.EG.steel = await steelOf("EG", ["أسعار الحديد اليوم عز بشاي الجارحي", "سعر الحديد اليوم في مصر الطن", "أسعار الحديد والأسمنت اليوم"], 1, 4, 48); } catch (e) { log("EG steel failed " + e.message); }
  try { auto.EG.cement = await cementEG(); } catch (e) { log("EG cement failed " + e.message); }
  try { auto.AE.steel = await steelOf("AE", ["أسعار الحديد اليوم في الإمارات حديد الإمارات كونارس", "سعر طن حديد التسليح في الإمارات درهم", "Emirates Steel rebar price per ton"], 1.08, 2, 21 * 24); } catch (e) { log("AE steel failed " + e.message); }
  try { auto.SA.steel = await steelOf("SA", ["أسعار الحديد اليوم في السعودية سابك الراجحي", "سعر طن الحديد اليوم السعودية ريال"], 1, 2, 21 * 24); } catch (e) { log("SA steel failed " + e.message); }
}
let checked = false, changed = false;
const LIMIT = {EG: 0.08, AE: 0.12, SA: 0.12};
for (const c of ["EG", "AE", "SA"]) for (const [k, n] of Object.entries(auto[c])) {
  if (guard(c, k, n, LIMIT[c])) { checked = true; if (cur[c][k].v !== n.v || cur[c][k].src_ar !== n.src_ar) { cur[c][k] = n; changed = true; } }
}
for (const c of ["EG", "AE", "SA"]) for (const [k, n] of Object.entries(ovr[c] || {})) {
  if (guard(c, k, n, 0.25) && (cur[c][k].v !== n.v || cur[c][k].src_ar !== n.src_ar)) { cur[c][k] = {...cur[c][k], ...n}; changed = true; checked = true; }
}
if (checked && cur.date !== TODAY) { cur.date = TODAY; changed = true; }
if (changed) {
  fs.writeFileSync("data/current.json", JSON.stringify(cur, null, 1));
  fs.writeFileSync("prices.js", "/* ميزان البناء — نشرة الأسعار اليومية · Reality Engineer */\nwindow.MIZAN_LIVE=" + JSON.stringify(cur) + ";\n");
}
log("CHANGED=" + (changed ? 1 : 0), "date=" + cur.date, "auto=" + JSON.stringify(Object.fromEntries(Object.entries(auto).map(([c, o]) => [c, Object.entries(o).filter(([, v]) => v).map(([k, v]) => k + ":" + v.v).join(",")]))));
fs.writeFileSync("data/last-run.log", new Date().toISOString() + "\n" + LOGS.join("\n") + "\n");
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, "changed=" + (changed ? 1 : 0) + "\n");
