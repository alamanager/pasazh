// مسیر: /functions/api/login.js
// درخواست: POST /api/login  { username, password }
// پاسخ موفق: { token, username, role, allowedPasazhIds }
//
// نکته‌ی مهم درباره‌ی اولین ورود (bootstrap):
// وقتی هنوز هیچ کاربری تو KV ساخته نشده، اگه یوزرنیم/پسورد وارد‌شده دقیقاً با
// Environment Variable های BOOTSTRAP_ADMIN_USER و BOOTSTRAP_ADMIN_PASS یکی باشه،
// خودش اولین کاربر رو به‌عنوان «مدیر کل» می‌سازه. بعد از اون، دیگه از همون
// کاربر KV-محور استفاده می‌شه (این دو متغیر محیطی رو می‌تونی حتی پاک کنی).

import { getUsers, saveUsers, hashPassword, randomHex, jsonResponse } from "../_auth.js";

export async function onRequestPost({ request, env }) {
  if (!env.PASAZH_KV) return jsonResponse({ error: "KV namespace وصل نشده (PASAZH_KV)" }, 500);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "درخواست نامعتبر" }, 400);
  }

  const username = (body.username || "").trim();
  const password = body.password || "";
  if (!username || !password) {
    return jsonResponse({ error: "نام کاربری و رمز رو وارد کن" }, 400);
  }

  let users = await getUsers(env);

  // Bootstrap: اولین ادمین رو از روی Environment Variables می‌سازه
  if (users.length === 0 && env.BOOTSTRAP_ADMIN_USER && env.BOOTSTRAP_ADMIN_PASS) {
    if (username === env.BOOTSTRAP_ADMIN_USER && password === env.BOOTSTRAP_ADMIN_PASS) {
      const salt = randomHex(16);
      const passwordHash = await hashPassword(password, salt);
      users = [{ username, salt, passwordHash, role: "admin", allowedPasazhIds: [] }];
      await saveUsers(env, users);
    }
  }

  const user = users.find((u) => u.username === username);
  if (!user) return jsonResponse({ error: "نام کاربری یا رمز اشتباهه" }, 401);

  const computedHash = await hashPassword(password, user.salt);
  if (computedHash !== user.passwordHash) {
    return jsonResponse({ error: "نام کاربری یا رمز اشتباهه" }, 401);
  }

  const token = randomHex(24);
  await env.PASAZH_KV.put(
    "session:" + token,
    JSON.stringify({ username: user.username, role: user.role, allowedPasazhIds: user.allowedPasazhIds || [] }),
    { expirationTtl: 60 * 60 * 24 * 7 } // 7 روز
  );

  return jsonResponse({
    token,
    username: user.username,
    role: user.role,
    allowedPasazhIds: user.allowedPasazhIds || [],
  });
}
