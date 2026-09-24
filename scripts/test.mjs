import {parseBrands, parseCement, text} from "./parse.mjs";
const eg = `<p>سجل سعر حديد عز نحو 39,850 جنيه للطن تسليم أرض المصنع، وبلغ سعر حديد بشاي 39,200 جنيه، وسعر حديد السويس للصلب 38,950 جنيه، وحديد الجارحي 38,100 جنيه، وحديد المصريين 37,350 جنيه، والمراكبي ٣٧٬٥٠٠ جنيه للطن.</p>
<p>وسجل متوسط سعر طن الأسمنت الرمادي 4,184 جنيه، ومتوسط أسعار الأسمنت 4,000 جنيه، وارتفع 135 جنيه.</p><script>var x="عز 99,999"</script>`;
const ae = `<div>أعلنت شركة حديد الإمارات عن سعر طن حديد التسليح 2,950 درهم لشهر أكتوبر، بينما سجلت كونارس 2,880 درهم للطن، وحديد الاتحاد 2,910 درهم، وحديد الجزيرة 2,860 درهم.</div>`;
const sa = `<div>سعر طن حديد سابك اليوم 3,441 ريال شامل الضريبة، وحديد الراجحي 3,381 ريال، وحديد اليمامة 3,350 ريال للطن.</div>`;
const E = parseBrands(text(eg), "EG"), A = parseBrands(text(ae), "AE"), S = parseBrands(text(sa), "SA"), C = parseCement(text(eg));
console.log(E, A, S, C);
const ok = E["عز"] === 39850 && E["المراكبي"] === 37500 && Object.keys(E).length === 6
  && A["حديد الإمارات"] === 2950 && A["كونارس"] === 2880 && Object.keys(A).length === 4
  && S["سابك"] === 3441 && S["الراجحي"] === 3381 && Object.keys(S).length === 3
  && C.includes(4184) && C.includes(4000) && !C.includes(135);
console.log(ok ? "PARSER OK" : "PARSER FAIL"); if (!ok) process.exit(1);
