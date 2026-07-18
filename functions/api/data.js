// مسیر: /functions/api/data.js
// GET  /api/data  -> بکاپ کامل (برای مدیر کل) یا فقط پاساژهای مجاز (برای کاربر محدود)
// POST /api/data  -> ذخیره؛ مدیر کل همه‌چیز رو می‌تونه بنویسه، کاربر محدود فقط
//                    می‌تونه پاساژهایی که از قبل بهش دسترسی داده شده رو آپدیت کنه
//                    (نمی‌تونه پاساژ جدید بسازه یا به پاساژ دیگه‌ای دست بزنه).
//
// هر دو نیاز به هدر دارن:  Authorization: Bearer <token>
// توکن از /api/login گرفته می‌شه.

import { verifySession, jsonResponse } from "../_auth.js";

const KV_KEY = "pasazh-backup";

export async function onRequestGet({ request, env }) {
  const session = await verifySession(request, env);
  if (!session) return jsonResponse({ error: "لطفاً وارد شو" }, 401);
  if (!env.PASAZH_KV) return jsonResponse({ error: "KV namespace وصل نشده (PASAZH_KV)" }, 500);

  const stored = await env.PASAZH_KV.get(KV_KEY);
  const all = stored ? JSON.parse(stored) : { exportedAt: null, pasazhIndex: [], pasazhData: {} };

  if (session.role === "admin") {
    return jsonResponse(all);
  }

  const allowed = new Set(session.allowedPasazhIds || []);
  const filteredIndex = (all.pasazhIndex || []).filter((p) => allowed.has(p.id));
  const filteredData = {};
  filteredIndex.forEach((p) => {
    if (all.pasazhData[p.id]) filteredData[p.id] = all.pasazhData[p.id];
  });
  return jsonResponse({ exportedAt: all.exportedAt, pasazhIndex: filteredIndex, pasazhData: filteredData });
}

export async function onRequestPost({ request, env }) {
  const session = await verifySession(request, env);
  if (!session) return jsonResponse({ error: "لطفاً وارد شو" }, 401);
  if (!env.PASAZH_KV) return jsonResponse({ error: "KV namespace وصل نشده (PASAZH_KV)" }, 500);

  let incoming;
  try {
    incoming = await request.json();
  } catch (e) {
    return jsonResponse({ error: "JSON نامعتبر" }, 400);
  }
  if (!incoming || !incoming.pasazhIndex || !incoming.pasazhData) {
    return jsonResponse({ error: "فرمت داده نامعتبره" }, 400);
  }

  const stored = await env.PASAZH_KV.get(KV_KEY);
  const current = stored ? JSON.parse(stored) : { exportedAt: null, pasazhIndex: [], pasazhData: {} };

  if (session.role === "admin") {
    await env.PASAZH_KV.put(
      KV_KEY,
      JSON.stringify({
        exportedAt: new Date().toISOString(),
        pasazhIndex: incoming.pasazhIndex,
        pasazhData: incoming.pasazhData,
      })
    );
    return jsonResponse({ ok: true });
  }

  // کاربر محدود: فقط پاساژهایی که مجاز هست و از قبل هم وجود داشته رو آپدیت می‌کنه
  const allowed = new Set(session.allowedPasazhIds || []);
  const existingIds = new Set((current.pasazhIndex || []).map((p) => p.id));
  const mergedIndex = [...(current.pasazhIndex || [])];
  const mergedData = { ...(current.pasazhData || {}) };

  (incoming.pasazhIndex || []).forEach((p) => {
    if (!allowed.has(p.id) || !existingIds.has(p.id)) return; // اجازه نداره یا وجود نداشته
    const idx = mergedIndex.findIndex((x) => x.id === p.id);
    if (idx >= 0) mergedIndex[idx] = p;
    if (incoming.pasazhData[p.id]) mergedData[p.id] = incoming.pasazhData[p.id];
  });

  await env.PASAZH_KV.put(
    KV_KEY,
    JSON.stringify({
      exportedAt: new Date().toISOString(),
      pasazhIndex: mergedIndex,
      pasazhData: mergedData,
    })
  );
  return jsonResponse({ ok: true });
}
