# Changelog

## 1.5.0

### Added

- **Taint markers**: Every tool call in the timeline now shows a source badge — `[network]` (blue) for web/HTTP tools, `[local:sensitive]` (orange) for reads from sensitive paths (`~/.ssh/`, `.env`, `/etc/passwd`, etc.), `[local]` (grey) for ordinary file/shell access. Helps identify which turns introduced untrusted external content.

## 1.4.0

### Added

- **Step-level credential badge**: Credential patterns detected in individual tool call results now show an `⚠ cred` badge directly on the timeline step row, in addition to the turn-level badge.

## 1.3.0

### Added

- **Credential scanning**: Detects API keys (`sk-ant-`, `sk-`, `ghp_`, `AKIA`), SSH private keys, and `.env` content appearing in assistant responses or tool results. Flagged turns show an `⚠ cred` badge in the turn list and inline orange highlights in the detail view. Scanning also covers URL-encoded patterns and credentials passed as tool inputs.

## 1.2.0

### Added

- **Multi-agent system prompt browsing**: Three-column Miller layout for the System Prompt page — browse prompts across all agent types (Claude Code, General Purpose, Explore, Web Search, Title Generator, Name Generator) with per-agent version history and diff viewer
- **Content-based version deduplication**: Version index keyed by `coreHash` instead of version string — identical system prompts across cc_version bumps are collapsed into a single entry with hash-based change detection
- **`KNOWN_AGENTS` registry**: Centralized agent type detection table replacing hardcoded if/else chains, with regex fallback for unknown future agent types
- **`sessionInferred` flag**: Entries attributed by inference (not explicit session_id) carry a `sessionInferred` flag through the full pipeline (store → forward → SSE → dashboard). Displayed as a yellow dashed "inferred" badge in the turn list and detail panel header.
- `CCXRAY_MAX_ENTRIES` environment variable to configure in-memory entry limit (default: 5000)
- Hub status endpoint includes `app: 'ccxray'` marker for identity verification
- 70 new tests (98 → 168) covering proxy E2E, SSE streaming, intercept lifecycle, error paths, concurrency, hub crash recovery, subagent session attribution, and agent type detection

### Fixed

- **Subagent session attribution**: Bare subagent requests (no session_id, no tools, no system prompt) were incorrectly assigned to a separate `direct-api` session. Now uses inflight request tracking + 30s temporal window to infer the parent session. Subagent path never pollutes global `currentSessionId`.
- **Minimap proportional accuracy**: `layoutMinimapBlocks` used `Math.max(blockEls.length, ...)` which inflated the blocks region when block count exceeded proportional height (e.g. 300 blocks at 24% usage displayed as 60%). Now uses proportional height as the authoritative ceiling.
- **Orphan hub detection**: When `hub.json` lockfile is missing but a hub is still running, clients now probe the default port and reconnect automatically instead of failing with EADDRINUSE
- **Browser auto-open**: First client connecting to a hub now opens the dashboard, regardless of whether the client forked the hub or discovered an existing one
- **ECONNRESET handling**: Upstream socket destruction mid-response no longer leaves the client hanging; added `proxyRes` error handler for both SSE and non-SSE paths
- **OOM on long-running hub**: In-memory entries capped at 5000 (configurable via `CCXRAY_MAX_ENTRIES`), oldest evicted first; disk logs unaffected
- **Version list accuracy**: Unchanged versions (same coreHash) are dimmed; size delta only shown when content actually changed; `firstSeen` uses file mtime instead of filename parsing

## 1.1.0

### Added

- **Multi-project hub**: Multiple `ccxray claude` instances automatically share a single proxy server and dashboard. No configuration needed — the first instance starts a hub, subsequent ones connect to it.
- **`ccxray status`**: New subcommand showing hub info and connected clients.
- **Hub crash auto-recovery**: If the hub process dies, connected clients detect and restart it within ~5 seconds.
- **Version compatibility check**: Clients with different major versions are rejected with a clear error message.

### Changed

- **Logs location**: Moved from `./logs/` (package-relative) to `~/.ccxray/logs/` (user home). Existing logs are automatically migrated on first run.
- **`--port` behavior**: Explicitly specifying `--port` now opts out of hub mode, running an independent server instead.

### Migration from 1.0.0

- Logs are automatically migrated from the old `logs/` directory to `~/.ccxray/logs/` on first startup. No manual action needed.
- If you use `AUTH_TOKEN`, hub discovery endpoints (`/_api/health`, `/_api/hub/*`) bypass authentication since they are local IPC.

## 1.0.0

Initial release.
