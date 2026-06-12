const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

// The server owns identity now. We ask it for a session (which sets a signed,
// httpOnly cookie) and cache the returned id for display. The cookie — not this
// value — is what the server trusts, so a client can't forge a vote identity.
let cached = null;

export async function ensureSession() {
  if (cached) return cached;
  try {
    const res = await fetch(`${SERVER_URL}/api/session`, { credentials: 'include' });
    const data = await res.json();
    cached = data.sessionId;
  } catch {
    cached = null; // offline; the socket will still attach a server-side anon id
  }
  return cached;
}

export function getSessionId() {
  return cached;
}
