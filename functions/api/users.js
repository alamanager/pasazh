// مسیر: /functions/api/users.js
// فقط مدیر کل (role === "admin") اجازه‌ی استفاده داره.
//
// GET  /api/users  -> لیست کاربرها (بدون رمز عبور)
// POST /api/users  -> ساخت/ویرایش یک کاربر:
//                     { username, password?, role, allowedPasazhIds }
//                     اگه username از قبل بود = ویرایش، وگرنه = کاربر جدید
//                     برای حذف: { action: "delete", username }

import { verifySession, getUsers, saveUsers, hashPassword, randomHex, jsonResponse } from "../_auth.js";

export async function onRequestGet({ request, env }) {
  const session = await verifySession(request, env);
  if (!session || session.role !== "admin") return jsonResponse({ error: "فقط مدیر کل اجازه داره" }, 403);
  if (!env.PASAZH_KV) return jsonResponse({ error: "KV namespace وصل نشده (PASAZH_KV)" }, 500);

  const users = await getUsers(env);
  return jsonResponse(
    users.map((u) => ({ username: u.username, role: u.role, allowedPasazhIds: u.allowedPasazhIds || [] }))
  );
}

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

  let users = await getUsers(env);

  if (body.action === "delete") {
    users = users.filter((u) => u.username !== body.username);
    await saveUsers(env, users);
    return jsonResponse({ ok: true });
  }

  const username = (body.username || "").trim();
  if (!username) return jsonResponse({ error: "نام کاربری لازمه" }, 400);

  let user = users.find((u) => u.username === username);

  if (!user) {
    if (!body.password) return jsonResponse({ error: "برای کاربر جدید رمز لازمه" }, 400);
    const salt = randomHex(16);
    const passwordHash = await hashPassword(body.password, salt);
    user = {
      username,
      salt,
      passwordHash,
      role: body.role === "admin" ? "admin" : "user",
      allowedPasazhIds: Array.isArray(body.allowedPasazhIds) ? body.allowedPasazhIds : [],
    };
    users.push(user);
  } else {
    if (body.password) {
      user.salt = randomHex(16);
      user.passwordHash = await hashPassword(body.password, user.salt);
    }
    if (body.role) user.role = body.role === "admin" ? "admin" : "user";
    if (Array.isArray(body.allowedPasazhIds)) user.allowedPasazhIds = body.allowedPasazhIds;
  }

  await saveUsers(env, users);
  return jsonResponse({ ok: true });
}
