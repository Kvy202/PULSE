import {
  castVote,
  getActiveRoundPayload,
  getFactionPayload,
  getWorldState,
  getRevealPayload,
  helloSoul,
} from '../game/loop.js';

// A tiny fixed-window rate limiter: at most `max` events per `windowMs` per
// socket, to blunt vote/hello floods. Returns false when the caller is over.
function makeLimiter(max, windowMs) {
  let count = 0;
  let windowStart = Date.now();
  return () => {
    const now = Date.now();
    if (now - windowStart > windowMs) {
      windowStart = now;
      count = 0;
    }
    count += 1;
    return count <= max;
  };
}

// Wires Socket.io connections to the game loop. Tracks live presence and syncs
// late joiners to the current round (or the verdict, mid-reveal) so everyone
// sees the same heartbeat. Identity is the server-signed id on socket.data.
export function registerSockets(io) {
  let presence = 0;

  io.on('connection', async (socket) => {
    presence += 1;
    io.emit('presence', { count: presence });

    const voteLimit = makeLimiter(10, 5000);
    const helloLimit = makeLimiter(5, 5000);

    // Sync this newcomer. Mid-reveal there is no live round, so send the verdict
    // instead of an expired countdown.
    const reveal = getRevealPayload();
    if (reveal) {
      socket.emit('round:resolve', reveal);
    } else {
      const round = getActiveRoundPayload();
      if (round) socket.emit('round:start', round);
    }

    const world = await getWorldState();
    if (world) socket.emit('world:update', { worldState: world });

    socket.emit('faction:update', getFactionPayload());

    // Identify this soul (using the authoritative id) so its tribe is known
    // before it votes; reply with its profile + any verdict it missed.
    socket.on('soul:hello', async () => {
      if (!helloLimit()) return;
      try {
        const profile = await helloSoul(socket.data.sessionId);
        if (profile) socket.emit('soul:state', profile);
        if (profile?.missed) socket.emit('absence', profile.missed);
      } catch (err) {
        console.error('[hello] error', err);
      }
    });

    // Vote attribution uses the server-signed identity, NOT anything the client
    // sends — this is what makes "one heartbeat, one vote" real.
    socket.on('vote:cast', ({ choice } = {}) => {
      if (!voteLimit()) return;
      castVote(socket.data.sessionId, choice, socket.data.ip).catch((err) =>
        console.error('[vote] error', err)
      );
    });

    socket.on('disconnect', () => {
      presence = Math.max(0, presence - 1);
      io.emit('presence', { count: presence });
    });
  });
}
