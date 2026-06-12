import dotenv from 'dotenv';

dotenv.config();

// All Phase 1 tunables live here. The server is the clock — these constants
// define the heartbeat that every connected soul is synced to.
export const config = {
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

  // Round cadence (fast mode): 20s to vote, 5s to reveal the verdict.
  voteMs: 20_000,
  revealMs: 5_000,

  // Live vote broadcasts are coalesced and flushed at most this often, so a
  // surge of votes can't flood every client with one message per vote.
  broadcastMs: 100,
};
