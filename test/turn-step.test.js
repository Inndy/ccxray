'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { computeTurnStep } = require('../server/helpers');
const { INJECTED_TAG_RE, isInjectedText } = require('../shared/injected-tags');

const userText = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const userToolResult = (id, body) => ({
  role: 'user',
  content: [{ type: 'tool_result', tool_use_id: id, content: body }],
});
const userMixed = (parts) => ({ role: 'user', content: parts });
const asstToolUse = (name) => ({
  role: 'assistant',
  content: [{ type: 'tool_use', id: 'tu_' + name, name, input: {} }],
});
const asstText = (text) => ({ role: 'assistant', content: [{ type: 'text', text }] });

test('first request, single human user-text message', () => {
  const messages = [userText('hello')];
  assert.deepEqual(computeTurnStep(messages), { turn: 1, step: 1 });
});

test('tool-loop step 2: user_text -> tool_use -> tool_result', () => {
  const messages = [
    userText('list files'),
    asstToolUse('Bash'),
    userToolResult('tu_Bash', 'a.txt\nb.txt'),
  ];
  assert.deepEqual(computeTurnStep(messages), { turn: 1, step: 2 });
});

test('tool-loop step 3', () => {
  const messages = [
    userText('list files'),
    asstToolUse('Bash'),
    userToolResult('tu_Bash', 'a.txt'),
    asstToolUse('Read'),
    userToolResult('tu_Read', 'contents'),
  ];
  assert.deepEqual(computeTurnStep(messages), { turn: 1, step: 3 });
});

test('mixed text + tool_result with system-reminder is not a new turn', () => {
  const messages = [
    userText('first prompt'),
    asstToolUse('Read'),
    userMixed([
      { type: 'tool_result', tool_use_id: 'tu_Read', content: 'data' },
      { type: 'text', text: '<system-reminder>You should remember X</system-reminder>' },
    ]),
  ];
  assert.deepEqual(computeTurnStep(messages), { turn: 1, step: 2 });
});

test('pure system-reminder user message is not a new turn', () => {
  const messages = [
    userText('hi'),
    asstText('hello there'),
    { role: 'user', content: [{ type: 'text', text: '<system-reminder>note</system-reminder>' }] },
  ];
  assert.deepEqual(computeTurnStep(messages), { turn: 1, step: 2 });
});

test('empty messages array does not throw', () => {
  assert.doesNotThrow(() => computeTurnStep([]));
  assert.deepEqual(computeTurnStep([]), { turn: 0, step: 0 });
});

test('null / undefined messages does not throw', () => {
  assert.doesNotThrow(() => computeTurnStep(null));
  assert.deepEqual(computeTurnStep(null), { turn: 0, step: 0 });
  assert.doesNotThrow(() => computeTurnStep(undefined));
});

test('second human turn after a completed tool loop', () => {
  const messages = [
    userText('first prompt'),
    asstToolUse('Bash'),
    userToolResult('tu_Bash', 'ok'),
    asstText('done'),
    userText('second prompt'),
  ];
  assert.deepEqual(computeTurnStep(messages), { turn: 2, step: 1 });
});

test('string-content user message counts as a human turn opener', () => {
  const messages = [{ role: 'user', content: 'plain string prompt' }];
  assert.deepEqual(computeTurnStep(messages), { turn: 1, step: 1 });
});

test('isInjectedText recognises all four injected tag types', () => {
  assert.equal(isInjectedText('<system-reminder>x</system-reminder>'), true);
  assert.equal(isInjectedText('<user-prompt-submit-hook>x</user-prompt-submit-hook>'), true);
  assert.equal(isInjectedText('<context>x</context>'), true);
  // Build the antml literal via concatenation so the test file is not parsed
  // as containing a tool-call by any harness.
  const A = '<' + 'antml:function_calls' + '>x</' + 'antml:function_calls' + '>';
  assert.equal(isInjectedText(A), true);
});

test('isInjectedText returns false for plain human text', () => {
  assert.equal(isInjectedText('hello world'), false);
  assert.equal(isInjectedText('please run the tests'), false);
  assert.equal(isInjectedText(''), false);
});

test('drift guard: dashboard inline regex matches shared module regex', () => {
  const messagesJsPath = path.join(__dirname, '..', 'public', 'messages.js');
  const src = fs.readFileSync(messagesJsPath, 'utf8');
  // Match the literal regex line in public/messages.js.
  const m = src.match(/INJECTED_TAG_RE\s*=\s*(\/[^;\n]+\/[a-z]*)/);
  assert.ok(m, 'public/messages.js must define INJECTED_TAG_RE');
  const dashboardRegexLiteral = m[1];
  const sharedRegexLiteral = INJECTED_TAG_RE.toString();
  assert.equal(
    dashboardRegexLiteral,
    sharedRegexLiteral,
    'public/messages.js INJECTED_TAG_RE must match shared/injected-tags.js'
  );
});
