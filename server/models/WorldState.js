import mongoose from 'mongoose';

// The single persistent global world. There is exactly one document, with
// _id 'global'. Every resolved round's consequence mutates it, and the next
// round inherits the result — the crowd is permanently editing reality.
const worldStateSchema = new mongoose.Schema({
  _id: { type: String, default: 'global' },
  survival: { type: Number, default: 100 }, // a meter the crowd raises/lowers
  era: { type: String, default: 'Dawn' },
  // The round number the current age began at. A `reset` consequence sets this
  // to "now" so the era genuinely restarts from Dawn rather than snapping back.
  ageBase: { type: Number, default: 0 },
  // Permanent relics the crowd has unlocked (Layer 4). Each is a small object.
  artifacts: {
    type: [{ name: String, icon: String, roundNumber: Number, ts: { type: Date, default: Date.now } }],
    default: [],
  },
  // Which color channels the world still has. A `tint` consequence permanently
  // drains one — the whole UI loses that color, forever, for every visitor.
  palette: {
    red: { type: Boolean, default: true },
    green: { type: Boolean, default: true },
    blue: { type: Boolean, default: true },
  },
  // A message the last crowd left for whoever arrives next (truth or lie). The
  // arriving soul is never told which it is.
  lastMessage: { type: mongoose.Schema.Types.Mixed, default: null },
  personality: {
    trust: { type: Number, default: 50 },
    chaos: { type: Number, default: 50 },
    mercy: { type: Number, default: 50 },
  },
  // All-time faction war standings, e.g. { Guardian: { wins: 12 }, ... }.
  // Stored loosely so factions can evolve without a migration.
  factions: { type: mongoose.Schema.Types.Mixed, default: {} },
  history: {
    type: [
      {
        roundNumber: Number,
        result: { type: String, enum: ['A', 'B'] },
        ts: { type: Date, default: Date.now },
      },
    ],
    default: [],
  },
});

export const WorldState = mongoose.model('WorldState', worldStateSchema);
