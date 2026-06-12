import mongoose from 'mongoose';

// One stranger's single vote in a round. The unique compound index on
// (roundId, sessionId) is a DB-level backstop against double-voting, beyond
// the in-memory dedupe in the game loop.
const voteSchema = new mongoose.Schema({
  roundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Round', required: true, index: true },
  sessionId: { type: String, required: true },
  choice: { type: String, enum: ['A', 'B'], required: true },
  region: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

voteSchema.index({ roundId: 1, sessionId: 1 }, { unique: true });

export const Vote = mongoose.model('Vote', voteSchema);
