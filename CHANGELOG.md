# Changelog

## [Unreleased]

### Fixed

- **Subagent session attribution**: Bare subagent requests (no session_id, no tools, no system prompt) were incorrectly assigned to a separate `direct-api` session. Now uses inflight request tracking + 30s temporal window to infer the parent session. Subagent path never pollutes global `currentSessionId`.
- **Minimap proportional accuracy**: `layoutMinimapBlocks` used `Math.max(blockEls.length, ...)` which inflated the blocks region when block count exceeded proportional height (e.g. 300 blocks at 24% usage displayed as 60%). Now uses proportional height as the authoritative ceiling.
- **Orphan hub detection**: When `hub.json` lockfile is missing but a hub is still running, clients now probe the default port and reconnect automatically instead of failing with EADDRINUSE
- **Browser auto-open**: First client connecting to a hub now opens the dashboard, regardless of whether the client forked the hub or discovered an existing one
- **ECONNRESET handling**: Upstream socket destruction mid-response no longer leaves the client hanging; added `proxyRes` error handler for both SSE and non-SSE paths
- **OOM on long-running hub**: In-memory entries capped at 5000 (configurable via `CCXRAY_MAX_ENTRIES`), oldest evicted first; disk logs unaffected

### Added

- **`sessionInferred` flag**: Entries attributed by inference (not explicit session_id) carry a `sessionInferred` flag through the full pipeline (store → forward → SSE → dashboard). Displayed as a yellow dashed "inferred" badge in the turn list and detail panel header.
- `CCXRAY_MAX_ENTRIES` environment variable to configure in-memory entry limit (default: 5000)
- Hub status endpoint includes `app: 'ccxray'` marker for identity verification
- 66 new tests (98 → 164) covering proxy E2E, SSE streaming, intercept lifecycle, error paths, concurrency, hub crash recovery, and subagent session attribution

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
