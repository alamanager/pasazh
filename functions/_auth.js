// این فایل مستقیم یه route نیست (اسمش با _ شروع می‌شه)، فقط توابع مشترک
// بین بقیه‌ی functions/api/*.js رو نگه می‌داره.

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomHex(byteLength) {
  const arr = new Uint8Array(byteLength);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
}

export async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return bytesToHex(bits);
}

export async function getUsers(env) {
  const raw = await env.PASAZH_KV.get("users");
  return raw ? JSON.parse(raw) : [];
}

export async function saveUsers(env, users) {
  await env.PASAZH_KV.put("users", JSON.stringify(users));
}

export async function verifySession(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const raw = await env.PASAZH_KV.get("session:" + token);
  if (!raw) return null;
  try {
    return JSON.parse(raw); // {username, role, allowedPasazhIds}
  } catch (e) {
    return null;
  }
}

export function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
