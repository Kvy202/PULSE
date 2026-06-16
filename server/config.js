import dotenv from 'dotenv';

dotenv.config();

// All Phase 1 tunables live here. The server is the clock — these constants
// define the heartbeat that every connected soul is synced to.
export const config = {
  // Behind an HTTPS proxy (ALB/nginx) in production: gates the Secure cookie flag.
  production: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pulse',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  // Secret used to sign session cookies so clients can't forge identities.
  // MUST be overridden in production via env.
  sessionSecret: process.env.SESSION_SECRET || 'pulse-dev-secret-change-me',

  // Anti-ballot-stuffing: how many votes one IP may cast per round. Shared NAT
  // means several real people can share an IP, so this is a ceiling, not 1.
  maxVotesPerIpPerRound: Number(process.env.MAX_VOTES_PER_IP) || 5,

  // How many rounds a "muted" soul is silenced for (the power/mute dilemma).
  muteRounds: Number(process.env.MUTE_ROUNDS) || 1,

  // Bots keep the world alive when few/no humans are around. They vote through
  // the same path as real souls, so they populate the brain, factions, and
  // alignments. "Souls awake" breathes randomly between min and max.
  botsEnabled: process.env.BOTS_ENABLED !== 'false',
  botPoolSize: Number(process.env.BOT_POOL) || 60, // distinct personas available
  botPresenceMin: Number(process.env.BOTS_MIN) || 4, // fewest bots "awake"
  botPresenceMax: Number(process.env.BOTS_MAX) || 22, // most bots "awake"
  botChurn: Number(process.env.BOTS_CHURN) || 3, // how much presence drifts per round
  botVoteProb: 0.75, // chance an awake bot actually votes in a round

  // Round cadence (fast mode): 20s to vote, 5s to reveal the verdict.
  voteMs: 20_000,
  revealMs: 5_000,

  // Live vote broadcasts are coalesced and flushed at most this often, so a
  // surge of votes can't flood every client with one message per vote.
  broadcastMs: 100,
};
