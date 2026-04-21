'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const store = require('../server/store');

function reset() {
  store.entries.length = 0;
  for (const k of Object.keys(store.sessionMeta)) delete store.sessionMeta[k];
  store._sysHashToAgentKey = new Map();
}

// Replicate the restore.js title-replay loop inline. Kept as a pure function
// here so we can exercise the heuristic without touching disk.
function replayTitles() {
  const sysMap = store._sysHashToAgentKey;
  if (!sysMap) return;
  for (const entry of store.entries) {
    if (!entry.sessionId || !entry.sysHash || !entry.title) continue;
    if (sysMap.get(entry.sysHash) !== 'title-generator') continue;
    const t = entry.title;
    if (t[0] === '{' || t.includes('\n') || t.length > 200) continue;
    store.setSessionTitle(entry.sessionId, t, entry.receivedAt || 0);
  }
}

describe('restore: replay title-generator entries', () => {
  beforeEach(reset);

  it('applies a clean title from a title-gen entry', () => {
    store._sysHashToAgentKey.set('hashA', 'title-generator');
    store.entries.push({
      sessionId: 'sA', sysHash: 'hashA', title: 'Fix login button',
      receivedAt: 1000,
    });
    replayTitles();
    assert.equal(store.getSessionTitle('sA'), 'Fix login button');
  });

  it('keeps the latest when the same session has multiple title-gen entries', () => {
    store._sysHashToAgentKey.set('hashA', 'title-generator');
    store.entries.push(
      { sessionId: 'sA', sysHash: 'hashA', title: 'old', receivedAt: 100 },
      { sessionId: 'sA', sysHash: 'hashA', title: 'new', receivedAt: 200 },
    );
    replayTitles();
    assert.equal(store.getSessionTitle('sA'), 'new');
  });

  it('skips legacy verbatim-user-text entries that look like raw JSON', () => {
    store._sysHashToAgentKey.set('hashA', 'title-generator');
    store.entries.push({
      sessionId: 'sA', sysHash: 'hashA',
      title: '{"title":"whatever"}', receivedAt: 100,
    });
    replayTitles();
    assert.equal(store.getSessionTitle('sA'), null);
  });

  it('skips entries with multi-line titles (legacy user-text)', () => {
    store._sysHashToAgentKey.set('hashA', 'title-generator');
    store.entries.push({
      sessionId: 'sA', sysHash: 'hashA',
      title: 'line one\nline two', receivedAt: 100,
    });
    replayTitles();
    assert.equal(store.getSessionTitle('sA'), null);
  });

  it('skips entries whose sysHash does not map to title-generator', () => {
    store._sysHashToAgentKey.set('hashA', 'explore');
    store.entries.push({
      sessionId: 'sA', sysHash: 'hashA', title: 'search something', receivedAt: 100,
    });
    replayTitles();
    assert.equal(store.getSessionTitle('sA'), null);
  });

  it('ignores entries without sessionId / sysHash / title', () => {
    store._sysHashToAgentKey.set('hashA', 'title-generator');
    store.entries.push(
      { sessionId: null, sysHash: 'hashA', title: 'x', receivedAt: 1 },
      { sessionId: 'sA', sysHash: null, title: 'x', receivedAt: 1 },
      { sessionId: 'sA', sysHash: 'hashA', title: null, receivedAt: 1 },
    );
    replayTitles();
    assert.equal(store.getSessionTitle('sA'), null);
  });
});
