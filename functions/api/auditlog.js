// مسیر: /functions/api/auditlog.js
// GET /api/auditlog  -> آخرین تغییرات ثبت‌شده. فقط مدیر کل می‌تونه ببینه.

import { verifySession, jsonResponse } from "../_auth.js";

const LOG_KEY = "audit-log";

export async function onRequestGet({ request, env }) {
  const session = await verifySession(request, env);
  if (!session || session.role !== "admin") return jsonResponse({ error: "فقط مدیر کل اجازه داره" }, 403);
  if (!env.PASAZH_KV) return jsonResponse({ error: "KV namespace وصل نشده (PASAZH_KV)" }, 500);

  const raw = await env.PASAZH_KV.get(LOG_KEY);
  const log = raw ? JSON.parse(raw) : [];
  return jsonResponse(log);
}
