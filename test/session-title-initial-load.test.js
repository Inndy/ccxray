'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const store = require('../server/store');
const { handleApiRoutes } = require('../server/routes/api');

function reset() {
  store.entries.length = 0;
  for (const k of Object.keys(store.sessionMeta)) delete store.sessionMeta[k];
}

function callEntriesApi() {
  return new Promise(resolve => {
    let body = '';
    const clientRes = {
      writeHead: () => {},
      end: (data) => { body = data; resolve(JSON.parse(body)); },
    };
    handleApiRoutes({ url: '/_api/entries' }, clientRes);
  });
}

describe('/_api/entries sessionTitles', () => {
  beforeEach(reset);

  it('includes titled sessions in sessionTitles', async () => {
    store.setSessionTitle('sid-aaa', 'Fix login button', 100);
    store.setSessionTitle('sid-bbb', 'Refactor auth', 200);
    const { sessionTitles } = await callEntriesApi();
    assert.equal(sessionTitles['sid-aaa'], 'Fix login button');
    assert.equal(sessionTitles['sid-bbb'], 'Refactor auth');
  });

  it('returns empty sessionTitles when no sessions have titles', async () => {
    store.sessionMeta['sid-aaa'] = { lastSeenAt: Date.now() };
    const { sessionTitles } = await callEntriesApi();
    assert.deepEqual(sessionTitles, {});
  });

  it('omits sessions whose title is null', async () => {
    store.sessionMeta['sid-aaa'] = { title: null, lastSeenAt: Date.now() };
    store.setSessionTitle('sid-bbb', 'Has a title', 100);
    const { sessionTitles } = await callEntriesApi();
    assert.ok(!('sid-aaa' in sessionTitles));
    assert.equal(sessionTitles['sid-bbb'], 'Has a title');
  });

  it('entries array is still present', async () => {
    const { entries } = await callEntriesApi();
    assert.ok(Array.isArray(entries));
  });
});
