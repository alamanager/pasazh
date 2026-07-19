// مسیر: /functions/api/file.js
// GET /api/file?key=file:xxxxx  -> برمی‌گردونه { dataUrl, name }
// نیاز به ورود داره (هر کاربر واردشده، نه فقط ادمین).

import { verifySession, jsonResponse } from "../_auth.js";

export async function onRequestGet({ request, env }) {
  const session = await verifySession(request, env);
  if (!session) return jsonResponse({ error: "لطفاً وارد شو" }, 401);
  if (!env.PASAZH_KV) return jsonResponse({ error: "KV namespace وصل نشده (PASAZH_KV)" }, 500);

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key || !key.startsWith("file:")) return jsonResponse({ error: "کلید نامعتبر" }, 400);

  const raw = await env.PASAZH_KV.get(key);
  if (!raw) return jsonResponse({ error: "فایل پیدا نشد" }, 404);

  return jsonResponse(JSON.parse(raw));
}
