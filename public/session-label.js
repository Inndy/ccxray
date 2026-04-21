'use strict';

// Returns the visible label for a session card / breadcrumb / intercept overlay.
// Prefers the Claude Code title-generator output when present; otherwise falls
// back to the 8-character short id, preserving the old synthetic label for
// direct-api traffic.
function formatSessionLabel(sess, sid) {
  if (sess && sess.title) return sess.title;
  if (sid === 'direct-api') return 'direct API';
  if (!sid) return '?';
  return sid.slice(0, 8);
}

function formatSessionTooltip(sess, sid) {
  const shortSid = sid === 'direct-api' ? 'direct API' : (sid || '').slice(0, 8);
  if (sess && sess.title) return sess.title + ' · ' + shortSid;
  return shortSid;
}

if (typeof window !== 'undefined') {
  window.formatSessionLabel = formatSessionLabel;
  window.formatSessionTooltip = formatSessionTooltip;
}
