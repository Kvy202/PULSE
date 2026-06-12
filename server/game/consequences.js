// Binding consequences. Each dilemma option declares a spec; when it wins, this
// turns the spec into (a) a dramatic record shown in the verdict and (b) Mongo
// update fragments that permanently mutate the shared world. Pure and testable.
//
// applyConsequence(spec, ctx) -> { record, inc, set, push }
//   record : { type, label, payload }  broadcast + stored on the Round
//   inc    : $inc fragment    (e.g. { survival: 3 })
//   set    : $set fragment    (e.g. { 'palette.blue': false }, lastMessage, reset)
//   push   : $push fragment   (e.g. { artifacts: { $each:[relic] } })  via $addToSet-like dedupe
//
// Everything falls back safely: an unknown/missing spec becomes a tiny survival
// nudge so the heartbeat can never be derailed by a malformed dilemma.

const COLORS = ['red', 'green', 'blue'];

function relic(name, icon, roundNumber) {
  return { name, icon, roundNumber, ts: new Date() };
}

export function applyConsequence(spec, ctx) {
  const { result, marginFraction = 0, world = {}, roundNumber = 0 } = ctx;

  try {
    switch (spec?.type) {
      case 'survival': {
        // Decisive votes move the meter more; direction comes from the spec.
        const base = spec.amount ?? 3;
        const amount = Math.round(base * (0.5 + marginFraction));
        return {
          record: {
            type: 'survival',
            label: spec.label ?? (amount >= 0 ? 'The world steadies.' : 'The world frays.'),
            payload: { amount },
          },
          inc: { survival: amount },
        };
      }

      case 'tint': {
        const ch = COLORS.includes(spec.remove) ? spec.remove : 'blue';
        const already = world?.palette && world.palette[ch] === false;
        return {
          record: {
            type: 'tint',
            label: already
              ? `${cap(ch)} was already gone. The world stays dimmed.`
              : `${cap(ch)} is gone. The world will never be ${ch} again.`,
            payload: { removed: ch },
          },
          set: { [`palette.${ch}`]: false },
        };
      }

      case 'message': {
        const text = spec.kind === 'lie' ? lie(world) : truth(world);
        return {
          record: {
            type: 'message',
            label: 'A message has been sealed for whoever comes next.',
            payload: { kind: spec.kind },
          },
          set: { lastMessage: { kind: spec.kind, text, roundNumber } },
        };
      }

      case 'artifact': {
        const name = spec.name ?? 'A Nameless Relic';
        return {
          record: {
            type: 'artifact',
            label: `The crowd unlocked ${name}. It is part of the world now.`,
            payload: { name, icon: spec.icon ?? '◆' },
          },
          push: { artifacts: relic(name, spec.icon ?? '◆', roundNumber) },
        };
      }

      case 'mute': {
        // Records a relic AND flags the loop to actually silence a random soul.
        return {
          record: {
            type: 'mute',
            label: 'A stranger has been silenced. Their next voice will not count.',
            payload: { action: 'mute' },
          },
          push: { artifacts: relic('A Silenced Voice', '✕', roundNumber) },
        };
      }

      case 'reset': {
        // Snap the world back to Day One and mark the event with a relic.
        return {
          record: {
            type: 'reset',
            label: 'THE WORLD HAS BEEN RESET. Everything begins again.',
            payload: {},
          },
          set: {
            survival: 100,
            ageBase: roundNumber, // restart the age → era recomputes to Dawn
            'personality.trust': 50,
            'personality.chaos': 50,
            'personality.mercy': 50,
            'palette.red': true,
            'palette.green': true,
            'palette.blue': true,
            lastMessage: null,
          },
          push: { artifacts: relic('The Great Reset', '↺', roundNumber) },
        };
      }

      default:
        return fallback(result);
    }
  } catch {
    return fallback(result);
  }
}

function fallback(result) {
  const amount = result === 'A' ? 1 : -1;
  return {
    record: { type: 'survival', label: 'The world shifts.', payload: { amount } },
    inc: { survival: amount },
  };
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// True message: a real fact about the world. Lie: a soothing falsehood.
function truth(world) {
  const s = world?.survival ?? 100;
  return `The truth: survival stands at ${s}.`;
}
function lie() {
  return 'All is well. The world is safe, and it always will be.';
}
