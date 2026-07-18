// مسیر: /functions/api/ping.js
// فقط برای تست: اگه بعد از دیپلوی، آدرس  /api/ping  رو مستقیم تو مرورگر باز کنی
// و این خروجی رو (نه صفحه‌ی اصلی سایت رو) دیدی، یعنی Functions درست وصل شده:
//   {"ok":true,"message":"Functions فعاله","hasKV":true/false}
// اگه به‌جاش همون صفحه‌ی اصلی HTML رو دیدی، یعنی پوشه‌ی functions اصلاً
// موقع دیپلوی شناسایی/آپلود نشده.

export async function onRequestGet({ env }) {
  return new Response(
    JSON.stringify({
      ok: true,
      message: "Functions فعاله",
      hasKV: !!env.PASAZH_KV,
    }),
    { headers: { "content-type": "application/json; charset=utf-8" } }
  );
}
