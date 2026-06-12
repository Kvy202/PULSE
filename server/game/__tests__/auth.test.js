import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSessionId, signSession, verify, parseCookies, sessionFromCookieHeader } from '../../auth.js';

test('a signed session round-trips', () => {
  const id = newSessionId();
  const signed = signSession(id);
  assert.equal(verify(signed), id);
});

test('a tampered session is rejected', () => {
  const signed = signSession(newSessionId());
  assert.equal(verify(signed + 'x'), null);
  assert.equal(verify('forged.signature'), null);
  assert.equal(verify(''), null);
  assert.equal(verify(undefined), null);
});

test('parseCookies reads name=value pairs', () => {
  const c = parseCookies('a=1; pulse_sid=abc.def; b=2');
  assert.equal(c.pulse_sid, 'abc.def');
  assert.equal(c.a, '1');
});

test('sessionFromCookieHeader extracts a verified id', () => {
  const id = newSessionId();
  const header = `pulse_sid=${signSession(id)}`;
  assert.equal(sessionFromCookieHeader(header), id);
  assert.equal(sessionFromCookieHeader('pulse_sid=garbage'), null);
});
