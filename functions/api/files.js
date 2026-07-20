// مسیر: /functions/api/files.js
// GET    /api/files            -> لیست فایل‌های آپلودشده (عکس نقشه، پیوست‌ها) با حجم تقریبی
// DELETE /api/files?key=file:xxx -> حذف یک فایل
// فقط مدیر کل اجازه داره — برای اینکه فضای KV پر نشه و بشه فایل‌های اضافه رو پاک کرد.

import { verifySession, jsonResponse } from "../_auth.js";

export async function onRequestGet({ request, env }) {
  const session = await verifySession(request, env);
  if (!session || session.role !== "admin") return jsonResponse({ error: "فقط مدیر کل اجازه داره" }, 403);
  if (!env.PASAZH_KV) return jsonResponse({ error: "KV namespace وصل نشده (PASAZH_KV)" }, 500);

  const list = await env.PASAZH_KV.list({ prefix: "file:" });
  const items = list.keys.map((k) => ({
    key: k.name,
    name: (k.metadata && k.metadata.name) || k.name,
    uploadedBy: k.metadata && k.metadata.uploadedBy,
    uploadedAt: k.metadata && k.metadata.uploadedAt,
    approxKB: k.metadata && k.metadata.approxKB,
  }));
  items.sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""));
  return jsonResponse(items);
}

export async function onRequestDelete({ request, env }) {
  const session = await verifySession(request, env);
  if (!session || session.role !== "admin") return jsonResponse({ error: "فقط مدیر کل اجازه داره" }, 403);
  if (!env.PASAZH_KV) return jsonResponse({ error: "KV namespace وصل نشده (PASAZH_KV)" }, 500);

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key || !key.startsWith("file:")) return jsonResponse({ error: "کلید نامعتبر" }, 400);
  await env.PASAZH_KV.delete(key);
  return jsonResponse({ ok: true });
}
