import crypto from 'crypto';
import { config } from './config.js';

// Server-issued, signed session identities. The client never picks its own id —
// the server mints one, signs it with a secret, and stores it in an httpOnly
// cookie. A client cannot forge a valid id without the secret, which raises
// ballot-stuffing from "mint a random string" to "clear cookies / use incognito"
// (then still capped per-IP). This is honest mitigation, not perfect sybil
// resistance — documented as such.

const COOKIE_NAME = 'pulse_sid';

export function newSessionId() {
  return crypto.randomUUID();
}

function sign(id) {
  const mac = crypto.createHmac('sha256', config.sessionSecret).update(id).digest('base64url');
  return `${id}.${mac}`;
}

// Returns the verified id, or null if the signature doesn't check out.
export function verify(signed) {
  if (typeof signed !== 'string' || !signed.includes('.')) return null;
  const idx = signed.lastIndexOf('.');
  const id = signed.slice(0, idx);
  const expected = sign(id);
  // Constant-time compare to avoid timing leaks.
  const a = Buffer.from(signed);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return id;
}

// Minimal cookie-header parser (avoids a dependency).
export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// Pull a verified session id from a request/handshake's cookie header.
export function sessionFromCookieHeader(header) {
  const cookies = parseCookies(header);
  return verify(cookies[COOKIE_NAME]);
}

export const SESSION_COOKIE = COOKIE_NAME;
export const signSession = sign;
