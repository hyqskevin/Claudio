# Claudio Project Assessment

Date: 2026-06-30

This assessment was produced from a source review plus parallel sub-agent reviews of backend/API/data flow, frontend/state integration, and engineering/documentation quality. `pnpm typecheck` and `pnpm build` both pass, so the main risks are runtime behavior, security, API contracts, and missing tests rather than TypeScript compilation.

## Executive Summary

Claudio has a coherent monorepo shape and a working build pipeline, but **it is not safe to expose to a LAN or production environment** in its current state. `pnpm typecheck` and `pnpm build` both pass, so the main risks are runtime behavior, security, API contracts, and missing tests rather than TypeScript compilation.

Highest-priority issues:

1. **P0 — Security**: `apps/server/ncm-server.mjs` contains a committed Netease session cookie. The Settings API masks some old key names but misses current ones (`minimax_api_key`, `kimi_api_key`, `ncm_cookie`), and the frontend can overwrite real secrets with mask text (`***已配置***`). The `/api/cover` proxy accepts arbitrary URLs and can forward cookies, creating an SSRF vector.
2. **P1 — Playback correctness**: `/api/now`, WebSocket `queue_updated`/`now_changed`, and queue persistence from generated plans return raw SQLite rows (snake_case) while the frontend expects camelCase `QueueItem`, breaking playback, lyrics, favorites, and covers.
3. **P2 — Configuration & verification**: `DATABASE_URL` is documented but ignored by `getDb()`. There is no `pnpm test` script; contract tests for the queue serializer, settings masking, and cover proxy validation must be added before the P0/P1 fixes are considered complete.

Recommended remediation order:

1. Security: remove committed Netease cookie, rotate the session, fix settings masking, and lock down proxy endpoints.
2. Playback correctness: standardize queue and playback-state serializers between backend, WebSocket, and frontend.
3. Configuration: make documented env vars match runtime behavior and stop ignoring `DATABASE_URL`.
4. Verification: add tests for the contracts that currently drift silently.

## Verified Commands

```bash
pnpm typecheck
pnpm build
```

Both commands passed on 2026-06-30.

There is currently no `pnpm test` script at the root or in either app package.

## Critical Issues

### P0: Committed Netease Session Cookie

`apps/server/ncm-server.mjs` contains a literal authenticated Netease cookie. Treat this as a leaked credential.

Required actions:

- Remove the literal cookie from source.
- Load Netease auth only from a local env var or persisted local setting.
- Rotate or invalidate the exposed Netease session before using the account again.
- Keep `.env` and local DB files ignored.

### P0: Settings API Can Expose or Overwrite Secrets

The settings API masks some old key names, but the runtime now reads current key names such as `minimax_api_key` and `kimi_api_key`. Those keys must never be returned in plaintext.

There is also a destructive data-flow bug: the frontend receives masked values like `***已配置***`, keeps them in state, and then sends the whole settings object back on any edit. The backend persists every string value, so editing one setting can overwrite a real secret with the mask sentinel.

Required actions:

- Mask or omit all secret keys: `minimax_api_key`, `kimi_api_key`, `fish_audio_api_key`, `openweather_api_key`, `feishu_app_secret`, `ncm_cookie`.
- Add an allowlist of accepted setting keys.
- Make updates patch-based per key, or have the backend ignore mask sentinel values for secret keys.
- Add local authentication before exposing settings beyond localhost.

### P0: Cover Proxy Allows SSRF and Cookie Forwarding

`/api/cover` accepts arbitrary HTTP URLs and fetches them server-side. It can also forward NCM cookie data to the requested upstream. With permissive CORS and binding to `0.0.0.0`, this can be abused by another device on the network.

Required actions:

- Allow only trusted Netease image hostnames.
- Reject private, loopback, link-local, and metadata-service IP ranges after DNS resolution.
- Never forward cookies to arbitrary cover URLs.
- Consider disabling the proxy unless it is needed for CORS.

## High-Priority Runtime Issues

### Queue and Now-Playing Contracts Drift

The frontend `QueueItem` type expects camelCase fields such as `songId`, `audioUrl`, `coverUrl`, and `text`. Some backend paths return raw SQLite rows with snake_case fields such as `song_id`, `audio_url`, and `tts_text`.

Affected flows:

- `/api/now`
- WebSocket `queue_updated`
- WebSocket `now_changed`
- queue persisted from generated plans

Impact:

- Planned queue items can appear without playable URLs in the frontend.
- Lyrics, favorites, covers, and playback controls can break after state comes from the server instead of local optimistic state.

Required actions:

- Add one backend serializer for public queue items.
- Use that serializer for `/api/now`, `/api/queue`, player routes, and WebSocket broadcasts.
- Persist or join song metadata so title, artist, and cover survive plan insertion.
- Add a contract test that compares API output to the frontend `QueueItem` shape.

### Chat Commands Do Not Control Browser Audio Reliably

Natural-language commands route through backend dispatch. The backend calls server-side player endpoints and reports success, but actual audio playback lives in the browser `AudioPlayer` and Zustand store.

Impact:

- Commands such as next, pause, and play can show success while browser audio does not change.

Required actions:

- For command JSON responses, have the frontend invoke local player-store actions.
- Or broadcast explicit command events over WebSocket and map them to local playback actions.
- Return command failure when backend command execution fails.

### Playback Mode Persistence Is Inconsistent

The backend exposes `playMode`, while the frontend reads and writes `play_mode`. The frontend also writes `shuffle`, but the SQLite table has no shuffle column.

Required actions:

- Standardize API shape on camelCase (`playMode`) or explicitly map both directions.
- Add a `shuffle` column or remove the claim that shuffle persists.
- Add a playback-state round-trip test.

## Medium-Priority Engineering Issues

### `DATABASE_URL` Is Documented but Ignored

`loadConfig()` exposes `DATABASE_URL`, but `getDb()` always writes to a build-relative hard-coded SQLite path. Dev and production builds can therefore use different DB files.

Required actions:

- Make DB initialization respect `DATABASE_URL`.
- Normalize `file:` URLs.
- Document the actual DB path once the code is aligned.

### `SERVER_PORT` and `PORT` Are Inconsistent

Runtime config listens on `SERVER_PORT`, but dispatch self-calls use `process.env.PORT ?? 8080`. Non-default ports can break command dispatch.

Required actions:

- Do not self-call over HTTP; call the shared player service directly.
- If HTTP self-calls remain, use `SERVER_PORT` or injected config.

### `start.sh` Kills Ports Broadly

`start.sh` kills any process on ports 3000, 8080, and 5173. This is convenient for a single-purpose machine but risky in a multi-repository workspace.

Required actions:

- Document this behavior prominently.
- Prefer pid-file based cleanup for processes started by this script.
- Offer a non-destructive dev path: start NCM, server, and web manually.

### Test Coverage Is Missing

There are no unit or integration tests and no `test` script. TypeScript and build checks pass, but they do not catch the current API contract and settings bugs.

Recommended first tests:

- Settings secret masking and mask-sentinel preservation.
- `/api/cover` URL validation.
- `/api/now` and WebSocket queue serialization.
- Playback-state restore/save round trip.
- Dispatch command execution against browser-local playback behavior.
- Chat stream abort behavior.

## Documentation Drift

The current README is mostly aligned with the implemented MiniMax/Kimi/MiniMax TTS architecture, but older files still describe Claude/Fish as the primary architecture. Treat these as historical specs unless updated:

- `PRODUCT_SPEC_AI_RADIO.md`
- `DEVELOPMENT_SPEC_AI_RADIO.md`
- `HANDOFF_TO_CC.md`

Known doc corrections:

- Node.js requirement is `>=20`, not `>=18`.
- Runtime env names include `NCM_COOKIE` and `NCM_UID`; `NETEASE_COOKIE` is not the active runtime name.
- Default `OPENWEATHER_CITY` in code is currently `Jiangxi`, while `.env.example` and README say `Shanghai`.
- `DATABASE_URL` is listed but not honored by current DB initialization.
- Current verification is `pnpm typecheck` and `pnpm build`; `pnpm test` does not exist yet.

## Development Policy Updates

Until the P0/P1 items are fixed:

- Do not expose the backend to untrusted networks.
- Do not commit real cookies, API keys, or local DB files.
- Use pnpm only; remove npm lockfiles and build artifacts from version control.
- Keep API response DTOs explicit and shared across REST and WebSocket paths.
- Add tests before refactoring queue, settings, or playback persistence.
