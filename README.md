# 🫀 PULSE

### *One decision. Made by all of humanity. Every cycle.*

A MERN-stack real-time social experiment where strangers around the world vote on
a single binary choice — and watch their private vote get devoured by the swarm,
with the majority's will reshaping a shared world-state for **everyone at once**.

> You think you're casting a private vote. You're not. You're one heartbeat in a
> global pulse.

---

## Status: Phase 1 — "Heartbeat" MVP

The working core: open two browser tabs, vote A/B, watch the live tally move on
both at once, then watch the server resolve a verdict and start the next round.
**The server owns the clock and the truth.** Clients only render what they're told.

- Cadence: **20s voting + 5s verdict reveal**, looping forever (tunable in
  [server/config.js](server/config.js)).
- Persistence: **MongoDB** (rounds, votes, and a single global `WorldState`
  survive restarts).

Deferred to later phases: the World-Brain canvas, Soul profiling/alignment,
factions, the meta-timeline, and LLM-generated dilemmas.

---

## Architecture

```
React (Vite, :5173) ──HTTP/WS──► Node+Express+Socket.io (:4000) ──► MongoDB
        ▲                                  │
        └────────── socket events ─────────┘
```

| Layer       | Tool                              |
|-------------|-----------------------------------|
| DB          | MongoDB (Mongoose)                |
| Server      | Node + Express                    |
| Real-time   | Socket.io                         |
| Client      | React + Vite                      |
| Round timing| a single server-side game loop    |

### Socket events

| Event           | Dir | Payload                                      |
|-----------------|-----|----------------------------------------------|
| `round:start`   | s→c | `{ roundNumber, dilemma, endsAt, tally }`     |
| `vote:cast`     | c→s | `{ sessionId, choice: 'A' \| 'B' }`           |
| `tally:update`  | s→c | `{ A, B }`                                    |
| `round:resolve` | s→c | `{ result, tally, consequence }`             |
| `world:update`  | s→c | `{ worldState }`                             |
| `presence`      | s→c | `{ count }`                                  |

---

## Getting started

### Prerequisites
- Node 18+
- A reachable MongoDB — either a local `mongod` or a MongoDB Atlas connection string.

### Setup

```bash
# 1. Install everything (root + server + client)
npm run install:all

# 2. Configure the server's Mongo connection
#    copy server/.env.example -> server/.env  and edit MONGO_URI if needed

# 3. Run both apps together
npm run dev
```

- Server: http://localhost:4000  (`/api/world`, `/api/history`, `/api/timeline`, `/api/metrics`)
- Client: http://localhost:5173

Open **two browser tabs** at the client URL, vote in each, and watch the swarm move.

---

## Deployment

A one-command stack (Mongo + server + static client) via Docker:

```bash
# set a real secret in production
SESSION_SECRET=$(openssl rand -base64 48) docker compose up --build
# client → http://localhost:8080   server/API → http://localhost:4000
```

The client's server URL is baked at build time (`VITE_SERVER_URL` build arg); the
server's allowed origin is `CLIENT_ORIGIN`. For a real domain, set both and
terminate TLS at a reverse proxy (wss is handled automatically by Socket.io).

### Scaling

PULSE runs **one authoritative game loop** — it is the clock. Run the server as a
**single instance**. To serve more concurrent sockets you fan out with the
[`@socket.io/redis-adapter`](https://socket.io/docs/v4/redis-adapter/) for
broadcast, while keeping the loop on a single leader (so there is still exactly
one heartbeat). In-memory state (the faction roster, per-IP caps, presence) is
per-process and would move to Redis in that setup.

## Vote integrity

Identity is **server-issued**: `GET /api/session` mints a session id and stores it
in a signed, httpOnly cookie. The socket handshake reads and verifies that cookie,
and **votes are attributed to the cookie's id, never to anything the client
sends** — so a client can't forge vote identities. A per-IP per-round cap
(`MAX_VOTES_PER_IP`) and per-socket rate limits blunt ballot-stuffing and floods.
This is honest mitigation, not perfect sybil resistance (incognito + fresh IPs
still get fresh identities); the per-IP cap is the backstop, with the shared-NAT
tradeoff noted in config.

## Tests & CI

Pure game logic (alignment, personality, eras, consequences, dilemma generation,
session signing) is covered by Node's built-in test runner:

```bash
npm --prefix server test
```

GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs the
server tests and a client build on every push and pull request.

## Metrics

`GET /api/metrics` returns live analytics for the running experiment: votes and
rounds since boot, rounds resolved, total souls, the alignment distribution, the
faction war standings, current survival/era, and uptime.

## Folder structure

```
pulse/
├── server/
│   ├── models/   Round, Vote, WorldState, Soul
│   ├── game/     dilemmas + the round loop (start, tally, resolve)
│   ├── sockets/  socket event handlers
│   ├── routes/   read-only history & world stats
│   └── index.js
└── client/
    └── src/
        ├── components/  Dilemma, SwarmTally, Verdict, Presence
        ├── hooks/       useSocket
        └── App.jsx
```
