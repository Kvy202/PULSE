import mongoose from 'mongoose';

// The current question everyone on Earth is answering. One active Round at a
// time; resolved Rounds become the permanent history of humanity's choices.
const roundSchema = new mongoose.Schema({
  roundNumber: { type: Number, required: true, unique: true, index: true },
  dilemma: {
    prompt: { type: String, required: true },
    optionA: { type: String, required: true },
    optionB: { type: String, required: true },
    theme: { type: String, default: 'general' },
  },
  startedAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  status: { type: String, enum: ['active', 'resolved'], default: 'active', index: true },
  tally: {
    A: { type: Number, default: 0 },
    B: { type: Number, default: 0 },
  },
  result: { type: String, enum: ['A', 'B', null], default: null },
  // The per-option consequence specs (what each choice would do to the world).
  // Persisted so resolve can apply the winner's; kept OUT of the client payload
  // so the exact effect stays a surprise until the verdict.
  consequenceSpec: { type: mongoose.Schema.Types.Mixed, default: null },
  // The applied outcome record, with its dramatic label, shown in the verdict.
  consequence: { type: mongoose.Schema.Types.Mixed, default: null },
});

export const Round = mongoose.model('Round', roundSchema);
