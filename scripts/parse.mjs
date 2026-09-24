// استخراج الأسعار من نص المقالات
export const toNum = s => {
  const t = String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[٫]/g, ".");
  return +t.replace(/[,٬\s]/g, "").replace(/\.\d{1,2}$/, "");
};
export const text = html => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ");
const N5 = "([0-9٠-٩]{2}[,٬.]?[0-9٠-٩]{3})";        // عشرات الآلاف (مصر)
const N4 = "([0-9٠-٩][,٬.]?[0-9٠-٩]{3})";           // آلاف (الإمارات والسعودية)
// مصانع الحديد في كل سوق + النطاق المنطقي للطن
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
// أسعار المصانع من نص مقال واحد: اسم المصنع وبعده في حدود 60 حرف رقم داخل النطاق
export function parseBrands(t, c) {
  const B = BRANDS[c], out = {};
  for (const [k, re] of Object.entries(B.list)) {
    const m = new RegExp("(?:" + re.source + ")[^0-9٠-٩]{0,60}" + B.pat, "i").exec(t);
    if (m) { const v = toNum(m[1]); if (v >= B.min && v <= B.max) out[k] = v; }
  }
  return out;
}
export const parseSteel = t => parseBrands(t, "EG");
// كل الأسعار المنطقية في صفحة منتج (متجر) — بنرجّع الوسيط
export function pagePrices(t, c) {
  const B = BRANDS[c], out = [];
  const re = new RegExp(B.pat, "g"); let m;
  while ((m = re.exec(t))) { const v = toNum(m[1]); if (v >= B.min && v <= B.max) out.push(v); }
  return out;
}
// متوسط الأسمنت: "متوسط ... 4,184"
export function parseCement(t) {
  const vals = [];
  const re = /متوسط[^0-9٠-٩]{0,50}([0-9٠-٩][,٬.]?[0-9٠-٩]{3})/g; let m;
  while ((m = re.exec(t))) { const v = toNum(m[1]); if (v >= 2500 && v <= 9000) vals.push(v); }
  return vals;
}

/* ---------- أسعار الوقود (بتحرك تكلفة النقل والحفر) ---------- */
/* زي toNum بس بيحافظ على الكسر العشري — سعر اللتر بيبقى 20.50 مش 20 */
function decNum(raw) {
  const AR = "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669";
  const t = String(raw).replace(/[\u0660-\u0669]/g, d => AR.indexOf(d))
                       .replace(/\u066B/g, ".").replace(/[\u066C,\u060C]/g, "").trim();
  const v = parseFloat(t);
  return isFinite(v) ? v : 0;
}
export function parseDieselEG(t) {
  const out = [];
  const re = /(?:السولار|سولار)\s*(?:اليوم)?\s*[:\-–—]?\s*([0-9٠-٩.,٫]{2,8})/g;
  let m; while ((m = re.exec(t))) { const v = decNum(m[1]); if (v >= 5 && v <= 80) out.push(v); }
  return out;
}
export function parseDieselGulf(t) {
  const out = [];
  const re = /(?:Diesel|الديزل|ديزل)[^0-9]{0,24}([0-9]+[.,][0-9]{2})/gi;
  let m; while ((m = re.exec(t))) { const v = parseFloat(String(m[1]).replace(",", ".")); if (v >= 1 && v <= 9) out.push(v); }
  return out;
}
