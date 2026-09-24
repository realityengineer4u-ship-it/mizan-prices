// استخراج الأسعار من نص المقالات
export const toNum = s => +String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[,٬.\s]/g, "");
export const text = html => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ");
const N = "([0-9٠-٩]{2}[,٬.]?[0-9٠-٩]{3})";
const STEEL = {"عز": /عز/, "بشاي": /بشاي/, "السويس": /السويس/, "الجارحي": /الجارحي/, "المصريين": /المصريين/, "المراكبي": /المراكبي/};

// أسعار الشركات من نص مقال واحد: اسم الشركة وبعده في حدود 60 حرف رقم بين 20 و80 ألف
export function parseSteel(t) {
  const out = {};
  for (const [k, re] of Object.entries(STEEL)) {
    const m = new RegExp(re.source + "[^0-9٠-٩]{0,60}" + N).exec(t);
    if (m) { const v = toNum(m[1]); if (v >= 20000 && v <= 80000) out[k] = v; }
  }
  return out;
}
// متوسط الأسمنت: "متوسط ... الأسمنت ... 4,184" أو "الأسمنت ... متوسط ... 4 آلاف"
export function parseCement(t) {
  const vals = [];
  const re = /متوسط[^0-9٠-٩]{0,50}([0-9٠-٩][,٬.]?[0-9٠-٩]{3})/g; let m;
  while ((m = re.exec(t))) { const v = toNum(m[1]); if (v >= 2500 && v <= 9000) vals.push(v); }
  return vals;
}
