// مسیر: /functions/api/login.js
// درخواست: POST /api/login  { username, password }
// پاسخ موفق: { token, username, role, allowedPasazhIds }
//
// اولین ورود (bootstrap):
// وقتی هنوز هیچ کاربری تو KV ساخته نشده، یه یوزر پیش‌فرض همیشه در دسترسه:
//   نام کاربری: admin
//   رمز:        admin123
// با همین وارد شو، بعد از داخل خود برنامه («⋮ بیشتر» → «تنظیمات همگام‌سازی» →
// «مدیریت کاربران») رمزشو عوض کن یا کاربرهای دیگه بساز. هیچ Environment Variable
// ای لازم نیست.

import { getUsers, saveUsers, hashPassword, randomHex, jsonResponse } from "../_auth.js";

const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_PASSWORD = "admin123";

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

  // Bootstrap: اگه هنوز هیچ کاربری نساختیم، با یوزر/رمز پیش‌فرض بالا اولین
  // ادمین رو خودکار می‌سازه (یا با BOOTSTRAP_ADMIN_USER/PASS اگه ست کرده باشی).
  if (users.length === 0) {
    const bootUser = env.BOOTSTRAP_ADMIN_USER || DEFAULT_ADMIN_USERNAME;
    const bootPass = env.BOOTSTRAP_ADMIN_PASS || DEFAULT_ADMIN_PASSWORD;
    if (username === bootUser && password === bootPass) {
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
