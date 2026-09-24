import {parseSteel, parseCement, text} from "./parse.mjs";
const html = `<html><body><h1>سعر الحديد اليوم الثلاثاء 22 سبتمبر 2026</h1><p>سجل سعر حديد عز نحو 39,850 جنيه للطن تسليم أرض المصنع، وبلغ سعر حديد بشاي 39,200 جنيه، وسعر حديد السويس للصلب 38,950 جنيه، وحديد الجارحي 38,100 جنيه، وحديد المصريين 37,350 جنيه، والمراكبي ٣٧٬٥٠٠ جنيه للطن.</p>
<p>وسجل متوسط سعر طن الأسمنت الرمادي 4,184 جنيه، ومتوسط أسعار الأسمنت 4,000 جنيه، وارتفع 135 جنيه.</p><script>var x="عز 99,999"</script></body></html>`;
const t = text(html), s = parseSteel(t), c = parseCement(t);
console.log(s, c);
const ok = s["عز"] === 39850 && s["المراكبي"] === 37500 && Object.keys(s).length === 6 && c.includes(4184) && c.includes(4000) && !c.includes(135);
console.log(ok ? "PARSER OK" : "PARSER FAIL"); if (!ok) process.exit(1);
