// مسیر: /functions/api/backups.js
// POST /api/backups  { type: "monthly"|"manual", label? }
//   monthly: یک‌بار در ماه (بر اساس تاریخ شمسی) یه نسخه می‌سازه؛ اگه همون ماه
//            قبلاً ساخته شده، دوباره چیزی نمی‌سازه.
//   manual:  هر بار که صدا زده بشه یه نسخه‌ی جدید با تاریخ/ساعت می‌سازه
//            (این همونیه که بعد از هر «ارسال به سرور» صدا زده می‌شه).
//
// GET /api/backups            -> لیست همه‌ی بکاپ‌ها (هر دو نوع)، جدیدترین اول
// GET /api/backups?key=...    -> خود دیتای اون بکاپ (برای دانلود)
// DELETE /api/backups?key=... -> حذف یک بکاپ
//
// فقط مدیر کل اجازه‌ی استفاده داره.

import { verifySession, jsonResponse } from "../_auth.js";

const KV_KEY = "pasazh-backup";
const PREFIX = "backup-";

export async function onRequestPost({ request, env }) {
  const session = await verifySession(request, env);
  if (!session || session.role !== "admin") return jsonResponse({ error: "فقط مدیر کل اجازه داره" }, 403);
  if (!env.PASAZH_KV) return jsonResponse({ error: "KV namespace وصل نشده (PASAZH_KV)" }, 500);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "درخواست نامعتبر" }, 400);
  }
  const type = body.type === "monthly" ? "monthly" : "manual";
  const label = (body.label || "").trim();

  const current = await env.PASAZH_KV.get(KV_KEY);
  if (!current) return jsonResponse({ created: false, reason: "هنوز داده‌ای برای بکاپ نیست" });

  let key;
  if (type === "monthly") {
    const monthKey = (body.jalaliMonthKey || "").trim();
    if (!/^\d{4}-\d{2}$/.test(monthKey)) return jsonResponse({ error: "فرمت ماه نامعتبره" }, 400);
    key = PREFIX + "monthly-" + monthKey;
    const existing = await env.PASAZH_KV.get(key);
    if (existing) return jsonResponse({ created: false, alreadyExisted: true });
  } else {
    key = PREFIX + "manual-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
  }

  await env.PASAZH_KV.put(
    key,
    JSON.stringify({
      type,
      label: label || null,
      savedAt: new Date().toISOString(),
      savedBy: session.username,
      payload: JSON.parse(current),
    })
  );
  return jsonResponse({ created: true, key });
}

export async function onRequestGet({ request, env }) {
  const session = await verifySession(request, env);
  if (!session || session.role !== "admin") return jsonResponse({ error: "فقط مدیر کل اجازه داره" }, 403);
  if (!env.PASAZH_KV) return jsonResponse({ error: "KV namespace وصل نشده (PASAZH_KV)" }, 500);

  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (key) {
    if (!key.startsWith(PREFIX)) return jsonResponse({ error: "کلید نامعتبر" }, 400);
    const raw = await env.PASAZH_KV.get(key);
    if (!raw) return jsonResponse({ error: "این بکاپ پیدا نشد" }, 404);
    return new Response(raw, { headers: { "content-type": "application/json; charset=utf-8" } });
  }

  const list = await env.PASAZH_KV.list({ prefix: PREFIX });
  const items = [];
  for (const k of list.keys) {
    const raw = await env.PASAZH_KV.get(k.name);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      items.push({ key: k.name, type: parsed.type, label: parsed.label, savedAt: parsed.savedAt, savedBy: parsed.savedBy });
    } catch (e) {
      /* ignore corrupted entry */
    }
  }
  items.sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
  return jsonResponse(items);
}

export async function onRequestDelete({ request, env }) {
  const session = await verifySession(request, env);
  if (!session || session.role !== "admin") return jsonResponse({ error: "فقط مدیر کل اجازه داره" }, 403);
  if (!env.PASAZH_KV) return jsonResponse({ error: "KV namespace وصل نشده (PASAZH_KV)" }, 500);

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key || !key.startsWith(PREFIX)) return jsonResponse({ error: "کلید نامعتبر" }, 400);
  await env.PASAZH_KV.delete(key);
  return jsonResponse({ ok: true });
}
