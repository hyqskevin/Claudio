# Claudio — AI Music Radio

## Architecture
- pnpm monorepo: apps/server (Fastify + TypeScript) + apps/web (React 19 + Vite + PWA)
- SQLite via better-sqlite3 for settings, playlists, plays history
- **LLM chain**: MiniMax M3 (Anthropic-compat, primary) → Kimi/Moonshot (OpenAI-compat, fallback) → Mock. Routed via `LlmRouter` in `apps/server/src/services/claude.service.ts`.
- **TTS chain**: MiniMax TTS (primary, 国内 hex-encoded MP3) → Fish Audio (fallback) → Mock. Three-tier wired in `apps/server/src/index.ts`.
- **NCM audio**: `/audio` endpoint on ncm-server.mjs falls back to yt-dlp when NCM has no streaming URL (copyright/region-blocked). Headers auto-negotiated per CDN.
- **TTS warmup**: 15 common DJ phrases pre-synthesized on server startup (`apps/server/src/services/tts-warmup.ts`), hit cache in <10ms.
- WebSocket for real-time updates (now_playing, queue, DJ messages)

## Key Commands
- `./start.sh` — **一键启动**（自动关闭旧进程 → NCM :3000 → 后端 :8080 → 前端 :5173，Ctrl+C 全部停止；会 kill 占用这些端口的任意进程）
- `pnpm dev` — start both server (:8080) and web (:5173) concurrently (不启动 NCM，不清理旧进程)
- `pnpm --filter @ai-radio/server build` — build server
- `pnpm --filter @ai-radio/web build` — build web (outputs to apps/web/dist)
- `pnpm typecheck` — current repo-wide static check
- `pnpm build` — current repo-wide production build check
- `cd apps/server && pnpm dev` — server only (tsx watch src/index.ts)
- `cd apps/web && pnpm dev` — web only (Vite dev server)

## Code Standards
- TypeScript strict mode, 4-space indent
- React functional components with hooks
- Zustand for state management (playerStore.ts)
- CSS in styles/global.css — dark theme, glassmorphism style
- Conventional Commits (feat:, fix:, docs:, chore:, refactor:)
- Branch model: main (stable) / develop / feat/* / fix/*

## Project Structure
- apps/server/src/routes/ — API route handlers
- apps/server/src/services/ — business logic (ncm, claude, tts, weather, etc.)
- apps/server/src/db/ — SQLite repos (settings, playlist, plays)
- apps/server/src/helpers/ — utilities (plan-enrich)
- apps/web/src/pages/ — route pages (Player, Playlist, Profile, Settings)
- apps/web/src/components/ — UI components
- apps/web/src/stores/ — Zustand stores
- apps/web/src/audio/ — AudioPlayer manager (HTMLAudioElement wrapper)
- apps/web/src/api/ — API client + WebSocket client

## Current Features
- AI-powered music planning (MiniMax M3 → Kimi fallback; JSON-structured plans with DJ lines + songs)
- NCM song search and playback with real audio streaming (yt-dlp fallback for blocked tracks)
- DJ TTS messages between songs (DjMessages + ChatArea; MiniMax TTS pre-warmed cache)
- LRC/karaoke lyrics display (KaraokeLyrics + LyricsPanel)
- 6 audio visualization modes (AudioVisualizer + AudioSpectrum)
- Playlist CRUD + NCM playlist browsing
- Play history tracking with real DB stats
- Song favorite/like system
- Volume control, shuffle/repeat modes
- Keyboard shortcuts + MediaSession API (lock screen/earphone controls)
- Toast notification system + loading skeletons
- MiniPlayer bottom bar
- Bilingual (EN/ZH) i18n with toggle button (🌐 icon, tooltip) in top nav
- PWA with service worker
- Profile page with real play stats (top artists, minutes listened, favorites)

## Known Gaps (to fix)
- See `docs/project-assessment.md` for the full software assessment and remediation order.
- P0: remove committed Netease cookie from `apps/server/ncm-server.mjs`, rotate that session, and load NCM auth only from local config.
- P0: settings masking misses current key names (`minimax_api_key`, `kimi_api_key`, `ncm_cookie`). The frontend keeps masked values (`***已配置***`) in state and can overwrite real secrets with the mask sentinel on any save.
- P0: `/api/cover` accepts arbitrary URLs and can forward cookies; restrict hosts and block private-network SSRF.
- P1: `/api/now`, `/api/queue`, player routes, and WebSocket events must share one camelCase `QueueItem` serializer; current raw DB rows (snake_case) can break frontend playback, lyrics, favorites, and covers.
- P1: chat command responses can report success without controlling the browser-local AudioPlayer.
- P1: playback state uses inconsistent `playMode` / `play_mode`; shuffle persistence is claimed but not represented in the DB schema.
- P2: `DATABASE_URL` is documented but ignored by `getDb()`.
- P2: `SERVER_PORT` and dispatch's internal `PORT` self-calls are inconsistent.
- P2: Scheduler cron `daily-playlist`/`morning-plan` generate plans but don't insert into queue table.
- LLM feedback loop: user favorites/dislikes aren't weighted in prompts (memory writer writes to user/*.md but no re-injection)
- No drag-to-reorder queue
- No UPnP casting
- No runnable `pnpm test` setup yet; current verification is `pnpm typecheck` and `pnpm build`. Contract tests for queue serialization, settings masking, and cover proxy validation should be added first.
