'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const store = require('../server/store');

// Test sessionIds must contain only [a-f0-9-] to match extractSessionId.
// Each test uses a unique sid so the shared sessionMeta map cannot leak
// state between tests.

const reqWithSid = (sid, msgCount = 1) => ({
  metadata: { user_id: JSON.stringify({ session_id: sid }) },
  system: [{ type: 'text', text: 'Primary working directory: /tmp/proj1\n' }],
  messages: Array.from({ length: msgCount }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: 'msg ' + i,
  })),
});

test('banner: first sight of an explicit session_id triggers isNewSession=true', () => {
  const sid = 'aaaaaaaa-1111-4111-8111-111111111111';
  const r = store.detectSession(reqWithSid(sid));
  assert.equal(r.sessionId, sid);
  assert.equal(r.isNewSession, true);
});

test('banner: second request with the same sid does not re-trigger', () => {
  const sid = 'bbbbbbbb-2222-4222-8222-222222222222';
  const r1 = store.detectSession(reqWithSid(sid));
  const r2 = store.detectSession(reqWithSid(sid, 3));
  assert.equal(r1.isNewSession, true);
  assert.equal(r2.isNewSession, false);
});

test('banner: switching A -> B -> A banners A only once', () => {
  const A = 'cccccccc-3333-4333-8333-333333333333';
  const B = 'dddddddd-3333-4333-8333-333333333333';
  const a1 = store.detectSession(reqWithSid(A));
  const b1 = store.detectSession(reqWithSid(B));
  const a2 = store.detectSession(reqWithSid(A, 5));
  assert.equal(a1.isNewSession, true);
  assert.equal(b1.isNewSession, true);
  assert.equal(a2.isNewSession, false);
});

test('banner: bannerPrinted persists across different request shapes', () => {
  const sid = 'eeeeeeee-4444-4444-8444-444444444444';
  store.detectSession(reqWithSid(sid, 1));
  const r = store.detectSession(reqWithSid(sid, 7));
  assert.equal(r.isNewSession, false);
  assert.equal(store.sessionMeta[sid].bannerPrinted, true);
});
