# 🫀 PULSE

### *One decision. Made by all of humanity. Every cycle.*

![CI](https://github.com/Kvy202/PULSE/actions/workflows/ci.yml/badge.svg)

A MERN-stack real-time social experiment where strangers around the world vote on
a single binary choice — and watch their private vote get devoured by the swarm,
the majority's will reshaping a shared, persistent world for **everyone at once**.

> You think you're casting a private vote. You're not. You're one heartbeat in a
> global pulse — and the collective is becoming someone.

Every visitor, anywhere, sees the **same dilemma at the same instant**. The server
owns the clock and the truth; clients only render what they're told. Vote, watch
the World-Brain convulse as thousands of strangers pull it toward A or B, then
watch the verdict permanently reshape the world — and the next round inherits it.

---

## ✨ What's inside

**The heartbeat**
- Server-authoritative game loop — one global clock, synced countdown, no client trust
- **20s vote → 5s verdict** cycle, looping forever (tunable)
- Live tally streamed over Socket.io; dramatic verdict reveal

**The living World-Brain** — a canvas neural mass where every real vote fires a
synapse toward its side; it convulses at 50/50 and blooms on a landslide, and
storms toward the winner on resolve.

**The surprise layers**
- **Souls & alignment** — after 5 votes you're profiled and given a character:
  *Guardian · Gambler · Contrarian · Martyr*, with a **real rarity** figure
- **Factions** — the tribes wage a live tug-of-war, with all-time war standings
- **The meta-reveal codex** — humanity's entire decision-history as a branching
  timeline, and the World-Brain's **emergent personality** (`trust / chaos / mercy`)
  rendered as a measurable character (*The Shepherd, The Tyrant, The Trickster…*)
- **Absence twist** — return after missing rounds and the world tells you:
  *"You weren't here. Strangers decided this for you."*

**Binding consequences** — every verdict *does something*, permanently, inherited
by the next visitor:
- 🎨 **Color loss** — delete a hue and the entire UI drains that channel forever
- ✉️ **Inherited messages** — leave the next soul the truth, or a comforting lie
- ◆ **Relics** — permanent artifacts the crowd unlocks, collected in the codex
- ↺ **Resets** — snap the world back to Day One (survival, era, palette, personality)
- ✕ **Real muting** — silence a random connected stranger for a round

**Living dilemmas** — a combinatorial engine (no LLM required) generating
**~13.7 million** distinct dilemmas from curated templates × word banks, each with
coherent, parameterized consequences, plus a recent-repeat guard.

**Hardened for real use** — signed-session vote integrity, per-IP caps, a
self-healing loop, bounded memory, batched broadcasts, unit tests, CI, a Docker
stack, and a live metrics endpoint.

---

## Architecture

```
React (Vite, :5173) ──HTTP / WebSocket──► Node + Express + Socket.io (:4000) ──► MongoDB
        ▲                                              │
        └───────────────── socket events ─────────────┘
             (synced rounds, live pulses, verdicts, world-state, presence)
```

| Layer        | Tool                                   |
|--------------|----------------------------------------|
| DB           | MongoDB (Mongoose)                     |
| Server       | Node + Express                         |
| Real-time    | Socket.io                              |
| Client       | React + Vite, Canvas/SVG World-Brain   |
| Round timing | a single server-side game loop (the clock) |

### Socket events

| Event           | Dir | Payload                                              |
|-----------------|-----|------------------------------------------------------|
| `round:start`   | s→c | `{ roundNumber, dilemma, endsAt, tally }`            |
| `vote:cast`     | c→s | `{ choice: 'A' \| 'B' }` — identity from signed cookie |
| `tally:update`  | s→c | `{ A, B, dA, dB }` (batched; deltas drive synapses)  |
| `round:resolve` | s→c | `{ result, tally, consequence, roundNumber }`        |
| `world:update`  | s→c | `{ worldState }`                                     |
| `presence`      | s→c | `{ count }`                                          |
| `faction:update`| s→c | `{ factions }` — live per-tribe A/B split            |
| `soul:hello`    | c→s | *(no payload)* — handshake; identity from cookie     |
| `soul:state`    | s→c | the soul's profile (alignment, streak, minorityRate) |
| `absence`       | s→c | `{ roundNumber, result, label, sinceRound }`         |
| `muted`         | s→c | `{ untilRound, rounds }`                             |

### HTTP API

| Endpoint                  | Purpose                                            |
|---------------------------|----------------------------------------------------|
| `GET /api/session`        | Mint/refresh the signed, httpOnly session cookie   |
| `GET /api/world`          | Current global `WorldState`                        |
| `GET /api/history`        | Recent resolved rounds                             |
| `GET /api/timeline`       | Personality + era + branching decision-history     |
| `GET /api/soul/:id`       | A soul's profile + alignment + rarity              |
| `GET /api/metrics`        | Live analytics for the running experiment          |
| `GET /health`             | Liveness check                                     |

---

## Getting started

**Prerequisites:** Node 18+ and a reachable MongoDB (local `mongod` or Atlas).

```bash
# 1. Install root + server + client
npm run install:all

# 2. Configure the server
cp server/.env.example server/.env   # edit MONGO_URI / SESSION_SECRET if needed

# 3. Run both apps together
npm run dev
```

- Client → http://localhost:5173
- Server/API → http://localhost:4000

Open **two browser tabs**, vote in each (click or press **A** / **B**), and watch
the swarm move, the verdict fall, and the world change for both at once.

---

## Living dilemmas

Instead of a finite hand-written list, dilemmas are generated combinatorially in
[server/game/dilemmaGen.js](server/game/dilemmaGen.js): curated templates with
`{slot}` placeholders filled from word banks (people, creatures, places, virtues,
relics), multiplied by an **adjective × entity** layer and a **"{virtue} of the
{entity}"** layer.

- **~13.7M** theoretically distinct dilemmas, in a tiny, fast file
- Each carries coherent, parameterized **consequences** for both options
- A **recent-repeat guard** keeps the same dilemma from recurring for a long stretch
- Theme selection is weighted by the collective's personality — a doubting crowd
  faces trust dilemmas, a chaotic one faces destructive ones
- An **LLM seam** (`LLM_API_KEY`) is ready if you ever want a model to author them

## Vote integrity

Identity is **server-issued**: `GET /api/session` mints an id and stores it in a
signed, httpOnly cookie. The socket handshake verifies that cookie, and **votes
are attributed to the cookie's id — never to anything the client sends** — so a
client can't forge vote identities. A per-IP per-round cap (`MAX_VOTES_PER_IP`)
and per-socket rate limits blunt ballot-stuffing and floods. This is honest
mitigation, not perfect sybil resistance (incognito + fresh IPs still get fresh
identities); the per-IP cap is the backstop, with the shared-NAT tradeoff noted
in config.

## Configuration & tuning

- Runtime/env: [server/config.js](server/config.js) + `server/.env`
  (`PORT`, `MONGO_URI`, `CLIENT_ORIGIN`, `SESSION_SECRET`, `MAX_VOTES_PER_IP`,
  `MUTE_ROUNDS`) — cadence (`voteMs`, `revealMs`) and broadcast batching live here too.
- Gameplay: [server/game/tuning.js](server/game/tuning.js) — alignment thresholds,
  personality drift magnitude, era boundaries, history buffer size, the reveal
  threshold. All the "magic numbers" in one place.

## Deployment

A one-command stack (Mongo + server + static client) via Docker:

```bash
SESSION_SECRET=$(openssl rand -base64 48) docker compose up --build
# client → http://localhost:8080   server/API → http://localhost:4000
```

The client's server URL is baked at build time (`VITE_SERVER_URL` build arg); the
server's allowed origin is `CLIENT_ORIGIN`. For a real domain, set both and
terminate TLS at a reverse proxy (wss is handled automatically by Socket.io).

### Scaling

PULSE runs **one authoritative game loop** — it is the clock — so run the server
as a **single instance**. To serve more concurrent sockets, fan out with the
[`@socket.io/redis-adapter`](https://socket.io/docs/v4/redis-adapter/) for
broadcast while keeping the loop on a single leader (still exactly one heartbeat).
In-memory state (faction roster, per-IP caps, presence, mutes) is per-process and
would move to Redis in that setup.

## Tests & CI

Pure game logic — alignment, personality, eras, consequences, dilemma generation
(variety + coverage), and session signing — is covered by Node's built-in runner:

```bash
npm --prefix server test
```

GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs the
server tests and a client build on every push and pull request.

## Metrics

`GET /api/metrics` returns live analytics: votes/rounds/mutes since boot, the
current round, rounds resolved, total souls, the alignment distribution, the
faction war standings, current survival/era, and uptime.

---

## Project structure

```
pulse/
├── docker-compose.yml          # Mongo + server + static client
├── .github/workflows/ci.yml    # tests + client build on push/PR
├── server/
│   ├── index.js                # express + socket.io bootstrap, /api/session, handshake auth
│   ├── auth.js                 # signed session cookies (HMAC)
│   ├── config.js               # env + cadence constants
│   ├── db.js
│   ├── models/                 # Round, Vote, WorldState, Soul
│   ├── game/
│   │   ├── loop.js             # the heartbeat: start / vote / resolve, mutes, metrics
│   │   ├── dilemmaGen.js       # combinatorial living-dilemma engine
│   │   ├── consequences.js     # bespoke binding consequences
│   │   ├── personality.js      # trust/chaos/mercy drift + eras
│   │   ├── alignment.js        # soul classification + factions
│   │   ├── tuning.js           # all gameplay tunables
│   │   └── __tests__/          # node:test unit suite
│   ├── sockets/                # connection, vote, hello, presence, rate limits
│   └── routes/stats.js         # world / history / timeline / soul / metrics
└── client/
    ├── Dockerfile + nginx.conf
    └── src/
        ├── App.jsx
        ├── socket.js, lib/      # session, alignments, collective
        ├── hooks/useSocket.js
        └── components/
            ├── WorldBrain.jsx       # the pulsing neural canvas
            ├── Dilemma.jsx          # choice + synced countdown
            ├── Verdict.jsx          # the dramatic reveal
            ├── Presence.jsx         # souls awake + alignment badge + era
            ├── Factions.jsx         # live tug-of-war
            ├── MetaReveal.jsx       # the codex: timeline + personality
            ├── AlignmentReveal.jsx  # "it's been watching me"
            ├── AbsenceReveal.jsx    # "you weren't here"
            ├── MessageBanner.jsx    # inherited message from the last crowd
            └── WorldPalette.jsx     # SVG filters for permanent color loss
```

---

*Today it's an illusion built on WebSockets. The pitch: in 2050 it's literal
neural-mesh networking. You're shipping the prototype 24 years early.*
