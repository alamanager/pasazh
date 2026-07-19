// مسیر: /functions/api/upload.js
// POST /api/upload
//   بدنه: { dataUrl, name, forPasazhId }
//   dataUrl یعنی همون base64 که مرورگر از canvas/فایل می‌سازه (data:image/jpeg;base64,....)
//   محدودیت حجم: حداکثر ۴ مگابایت بعد از فشرده‌سازی سمت مرورگر (این عدد رو خود
//   صفحه قبل از ارسال رعایت می‌کنه، اینجا هم دوباره چک می‌شه که کسی دور نزنه).
//
// پاسخ موفق: { key }  -> این key رو بعداً برای گرفتن/نمایش فایل با
// GET /api/file?key=... استفاده کن.
//
// نکته‌ی امنیتی ساده‌شده: هر کاربر واردشده (نه فقط ادمین) می‌تونه آپلود/دانلود کنه.
// دسترسی دقیق‌تر (فقط پاساژ مجاز) برای این نسخه‌ی ساده پیاده نشده.

import { verifySession, jsonResponse } from "../_auth.js";

const MAX_BYTES = 4 * 1024 * 1024; // 4MB

export async function onRequestPost({ request, env }) {
  const session = await verifySession(request, env);
  if (!session) return jsonResponse({ error: "لطفاً وارد شو" }, 401);
  if (!env.PASAZH_KV) return jsonResponse({ error: "KV namespace وصل نشده (PASAZH_KV)" }, 500);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "درخواست نامعتبر" }, 400);
  }
  const dataUrl = body.dataUrl || "";
  if (!dataUrl.startsWith("data:")) return jsonResponse({ error: "فرمت فایل نامعتبره" }, 400);

  // تخمین حجم از روی طول base64 (هر ۴ کاراکتر base64 ≈ ۳ بایت)
  const approxBytes = Math.floor((dataUrl.length * 3) / 4);
  if (approxBytes > MAX_BYTES) {
    return jsonResponse({ error: "حجم فایل زیاده (حداکثر ۴ مگابایت)" }, 400);
  }

  const key = "file:" + crypto.randomUUID();
  await env.PASAZH_KV.put(
    key,
    JSON.stringify({
      dataUrl,
      name: body.name || "file",
      uploadedBy: session.username,
      uploadedAt: new Date().toISOString(),
    })
  );

  return jsonResponse({ key });
}
