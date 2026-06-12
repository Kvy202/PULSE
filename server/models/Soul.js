import mongoose from 'mongoose';

// A returning visitor's identity, keyed by their server-signed session id.
const soulSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  alignment: { type: String, default: null },
  votesCast: { type: Number, default: 0 },
  minorityCount: { type: Number, default: 0 }, // times this soul sided with the losing option
  streak: { type: Number, default: 0 }, // consecutive rounds voted in
  lastVotedRound: { type: Number, default: 0 }, // for computing the streak
  lastSeenRound: { type: Number, default: 0 }, // for the "you weren't here" absence twist
  minorityRate: { type: Number, default: 0 }, // cached minorityCount / votesCast (set at reveal time)
  region: { type: String, default: null }, // reserved (geo not derived yet)
  firstSeen: { type: Date, default: Date.now },
});

export const Soul = mongoose.model('Soul', soulSchema);
