// استخراج الأسعار من نص المقالات
export const toNum = s => {
  const t = String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[٫]/g, ".");
  return +t.replace(/[,٬\s]/g, "").replace(/\.\d{1,2}$/, "");
};
export const text = html => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ");
const N5 = "([0-9٠-٩]{2}[,٬.]?[0-9٠-٩]{3})";
const N4 = "([0-9٠-٩][,٬.]?[0-9٠-٩]{3})";
export const BRANDS = {
  EG: {min: 20000, max: 80000, pat: N5, list: {
    "عز": /عز/, "بشاي": /بشاي/, "السويس": /السويس/, "الجارحي": /الجارحي/, "المصريين": /المصريين/, "المراكبي": /المراكبي/}},
  AE: {min: 1800, max: 6000, pat: N4, list: {
    "حديد الإمارات": /حديد الإمارات|Emirates Steel/i, "كونارس": /كونارس|Conares/i,
    "الاتحاد": /حديد الاتحاد|Union Iron/i, "الجزيرة": /حديد الجزيرة|Al Jazeera Steel/i}},
  SA: {min: 1800, max: 7000, pat: N4, list: {
    "سابك": /سابك|SABIC/i, "الراجحي": /الراجحي|Al[- ]?Rajhi/i,
    "اليمامة": /اليمامة|Yamama/i, "الاتحاد": /حديد الاتحاد|Ittihad Steel/i}},
};
export const EN_BRAND = {
  "عز": "Ezz", "بشاي": "Beshay", "السويس": "Suez", "الجارحي": "El Garhy", "المصريين": "Egyptian Steel", "المراكبي": "El Marakby",
  "حديد الإمارات": "Emirates Steel", "كونارس": "Conares", "الاتحاد": "Union Iron", "الجزيرة": "Al Jazeera Steel",
  "سابك": "SABIC", "الراجحي": "Al Rajhi", "اليمامة": "Yamama",
};
export function parseBrands(t, c) {
  const B = BRANDS[c], out = {};
  for (const [k, re] of Object.entries(B.list)) {
    const m = new RegExp("(?:" + re.source + ")[^0-9٠-٩]{0,60}" + B.pat, "i").exec(t);
    if (m) { const v = toNum(m[1]); if (v >= B.min && v <= B.max) out[k] = v; }
  }
  return out;
}
export const parseSteel = t => parseBrands(t, "EG");
export function pagePrices(t, c) {
  const B = BRANDS[c], out = [];
  const re = new RegExp(B.pat, "g"); let m;
  while ((m = re.exec(t))) { const v = toNum(m[1]); if (v >= B.min && v <= B.max) out.push(v); }
  return out;
}
export function parseCement(t) {
  const vals = [];
  const re = /متوسط[^0-9٠-٩]{0,50}([0-9٠-٩][,٬.]?[0-9٠-٩]{3})/g; let m;
  while ((m = re.exec(t))) { const v = toNum(m[1]); if (v >= 2500 && v <= 9000) vals.push(v); }
  return vals;
}

export function pageMax(t, c) {
  const v = pagePrices(t, c);
  return v.length ? Math.max(...v) : NaN;
}
