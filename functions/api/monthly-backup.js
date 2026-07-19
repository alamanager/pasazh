// مسیر: /functions/api/monthly-backup.js
// POST /api/monthly-backup  { jalaliMonthKey: "1404-05" }
//   یه کپی از بلاک اصلی رو زیر کلید monthly-backup-1404-05 ذخیره می‌کنه.
//   اگه از قبل برای همون ماه ساخته شده باشه، دوباره چیزی نمی‌سازه (idempotent) —
//   یعنی هر چندبار هم صدا زده بشه (مثلاً هر بار که مدیر وارد می‌شه)، فقط یه‌بار
//   واقعاً ذخیره می‌کنه.
//
// GET /api/monthly-backup            -> لیست ماه‌هایی که بکاپ دارن
// GET /api/monthly-backup?month=1404-05 -> خود اون بکاپ رو برمی‌گردونه

import { verifySession, jsonResponse } from "../_auth.js";

const KV_KEY = "pasazh-backup";
const PREFIX = "monthly-backup-";

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
  const monthKey = (body.jalaliMonthKey || "").trim();
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return jsonResponse({ error: "فرمت ماه نامعتبره" }, 400);

  const backupKey = PREFIX + monthKey;
  const existing = await env.PASAZH_KV.get(backupKey);
  if (existing) return jsonResponse({ created: false, alreadyExisted: true });

  const current = await env.PASAZH_KV.get(KV_KEY);
  if (!current) return jsonResponse({ created: false, reason: "no data yet" });

  await env.PASAZH_KV.put(backupKey, current);
  return jsonResponse({ created: true });
}

export async function onRequestGet({ request, env }) {
  const session = await verifySession(request, env);
  if (!session || session.role !== "admin") return jsonResponse({ error: "فقط مدیر کل اجازه داره" }, 403);
  if (!env.PASAZH_KV) return jsonResponse({ error: "KV namespace وصل نشده (PASAZH_KV)" }, 500);

  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  if (month) {
    const raw = await env.PASAZH_KV.get(PREFIX + month);
    if (!raw) return jsonResponse({ error: "بکاپی برای این ماه نیست" }, 404);
    return new Response(raw, { headers: { "content-type": "application/json; charset=utf-8" } });
  }
  const list = await env.PASAZH_KV.list({ prefix: PREFIX });
  return jsonResponse(
    list.keys.map((k) => k.name.replace(PREFIX, "")).sort().reverse()
  );
}
