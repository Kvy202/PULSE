import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

import { config } from './config.js';
import { connectDb } from './db.js';
import { statsRouter } from './routes/stats.js';
import { registerSockets } from './sockets/index.js';
import {
  newSessionId,
  signSession,
  SESSION_COOKIE,
  sessionFromCookieHeader,
} from './auth.js';
import * as loop from './game/loop.js';

// Best-effort client IP, honoring a single proxy hop's X-Forwarded-For.
function clientIp(handshakeOrReq) {
  const xff = handshakeOrReq.headers?.['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return handshakeOrReq.address || handshakeOrReq.ip || handshakeOrReq.connection?.remoteAddress || 'unknown';
}

async function main() {
  await connectDb();

  const app = express();
  app.set('trust proxy', true);
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // Issue (or refresh) a server-signed session. The client calls this once
  // before connecting; the httpOnly cookie becomes the authoritative identity.
  app.get('/api/session', (req, res) => {
    let id = sessionFromCookieHeader(req.headers.cookie);
    if (!id) id = newSessionId();
    res.cookie(SESSION_COOKIE, signSession(id), {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.production, // Secure only in prod (so http://localhost still works)
      maxAge: 1000 * 60 * 60 * 24 * 365,
    });
    res.json({ sessionId: id });
  });

  app.use('/api', statsRouter);

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: config.clientOrigin, methods: ['GET', 'POST'], credentials: true },
  });

  // Handshake auth: derive the authoritative session id from the signed cookie.
  // Cookie-less clients get an ephemeral per-connection id (still IP-capped).
  io.use((socket, next) => {
    const fromCookie = sessionFromCookieHeader(socket.handshake.headers.cookie);
    socket.data.sessionId = fromCookie || `anon-${newSessionId()}`;
    socket.data.trusted = Boolean(fromCookie);
    socket.data.ip = clientIp(socket.handshake);
    next();
  });

  loop.init(io);
  registerSockets(io);

  // If the port is taken, exit instead of running a phantom game loop against
  // the shared DB (which would leapfrog round numbers with the real instance).
  server.on('error', (err) => {
    console.error('[server] listen failed — exiting', err.code || err);
    process.exit(1);
  });

  // Start the heartbeat ONLY after we've actually bound the port.
  server.listen(config.port, async () => {
    console.log(`[server] PULSE listening on http://localhost:${config.port}`);
    if (config.sessionSecret === 'pulse-dev-secret-change-me') {
      console.warn('[server] WARNING: using the default SESSION_SECRET — set one in production.');
    }
    await loop.bootstrap();
  });
}

// Safety nets: log stray async failures instead of letting them destabilize the
// process silently. The game loop has its own recovery (scheduleNextPhase).
process.on('unhandledRejection', (err) => console.error('[server] unhandledRejection', err));
process.on('uncaughtException', (err) => console.error('[server] uncaughtException', err));

main().catch((err) => {
  console.error('[server] fatal', err);
  process.exit(1);
});
