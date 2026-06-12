import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyConsequence } from '../consequences.js';

const ctx = (over = {}) => ({
  result: 'A',
  marginFraction: 0.5,
  world: { survival: 77, palette: { red: true, green: true, blue: true } },
  roundNumber: 9,
  ...over,
});

test('survival consequence increments survival and scales with margin', () => {
  const out = applyConsequence({ type: 'survival', amount: 4, label: 'X' }, ctx());
  assert.equal(out.inc.survival, 4); // 4 * (0.5 + 0.5)
  assert.equal(out.record.type, 'survival');
});

test('tint consequence removes the named channel', () => {
  const out = applyConsequence({ type: 'tint', remove: 'blue' }, ctx());
  assert.equal(out.set['palette.blue'], false);
  assert.match(out.record.label, /blue/i);
});

test('truth message embeds a real fact; lie does not', () => {
  const t = applyConsequence({ type: 'message', kind: 'truth' }, ctx());
  assert.match(t.set.lastMessage.text, /77/);
  const l = applyConsequence({ type: 'message', kind: 'lie' }, ctx());
  assert.equal(l.set.lastMessage.kind, 'lie');
  assert.doesNotMatch(l.set.lastMessage.text, /77/);
});

test('artifact consequence pushes a named relic', () => {
  const out = applyConsequence({ type: 'artifact', name: 'A Relic', icon: '◆' }, ctx());
  assert.equal(out.push.artifacts.name, 'A Relic');
  assert.equal(out.push.artifacts.roundNumber, 9);
});

test('reset restores the world and restarts the age', () => {
  const out = applyConsequence({ type: 'reset' }, ctx());
  assert.equal(out.set.survival, 100);
  assert.equal(out.set.ageBase, 9);
  assert.equal(out.set['palette.blue'], true);
  assert.equal(out.push.artifacts.name, 'The Great Reset');
});

test('mute records a relic and flags the silencing action', () => {
  const out = applyConsequence({ type: 'mute' }, ctx());
  assert.equal(out.record.type, 'mute');
  assert.equal(out.record.payload.action, 'mute');
  assert.equal(out.push.artifacts.name, 'A Silenced Voice');
});

test('malformed spec falls back to a small survival nudge', () => {
  const out = applyConsequence(undefined, ctx({ result: 'B' }));
  assert.equal(out.inc.survival, -1);
});
