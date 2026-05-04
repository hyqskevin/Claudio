# Plan: Port kabaBZ Features to Claudio

## Context
kabaBZ/Claudio (Express+vanilla JS) has excellent visual effects, AI memory, playback persistence, voice/DJ mode, and schedule system. Our Claudio (Fastify+React+TypeScript) has a better architecture but lacks these experiential features. Port the best parts while maintaining our tech stack.

## Reference files
- kabaBZ source: /tmp/Claudio-kabaBZ/
- Target project: /projects/Claudio/apps/

---

## Task 1: Backend — AI Memory + Playback State API (apps/server/src/)

### 1a. AI Memory System
- In `routes/intent.ts` and `routes/chat.ts`: after Claude responds, parse `memory` field from JSON response
- If `memory` entries exist, append to corresponding user/ config files:
  - `memory[].file == "taste"` → append to `user/taste.md`
  - `memory[].file == "routines"` → append to `user/routines.md`  
  - `memory[].file == "moodrules"` → append to `user/mood-rules.md`
- Reference: kabaBZ server.js lines 498-511
- Create helper: `helpers/memory-writer.ts`

### 1b. Playback State API
- Add `playback_state` table to `db/schema.sql` (single-row pattern):
  ```sql
  CREATE TABLE IF NOT EXISTS playback_state (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    current_song_id TEXT,
    current_song_name TEXT,
    current_song_artist TEXT,
    current_song_album TEXT,
    current_song_cover TEXT,
    progress_seconds REAL DEFAULT 0,
    queue_data TEXT,
    queue_index INTEGER DEFAULT 0,
    play_mode TEXT DEFAULT 'off',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  ```
- Add to `db/` folder: `playback.repo.ts` with get/update methods
- Add routes in `routes/player.ts`:
  - `GET /api/playback-state` — returns saved state
  - `PUT /api/playback-state` — saves current state (debounced client-side)

### 1c. Message Dispatch (intent router enhancement)
- In `routes/intent.ts`, add fast-path command detection before hitting Claude:
  - "下一首" → `{type:"command", action:"next"}`
  - "暂停"/"播放" → `{type:"command", action:"play"/"pause"}`
  - "随机播放" → `{type:"command", action:"shuffle"}`
  - "搜索XXX" → `{type:"music_search", keyword:"XXX"}`
- Reference: kabaBZ server.js lines 419-453

### 1d. Schedule/Mood Config API
- Add `GET/POST /api/schedule` routes (read/write `config/schedule.json`)
- Add `GET /api/config` routes (read user/*.md files)
- Reference: kabaBZ server.js lines 346-377

---

## Task 2: Frontend — Dynamic Visuals (apps/web/src/)

### 2a. Color Extraction Module
- Create `utils/colorExtractor.ts`
- Port k-means algorithm from kabaBZ visual.js lines 34-107
- Function: `extractColors(imageUrl: string) → {primary, secondary, accent}`
- Sets CSS custom properties: `--color-primary`, `--color-secondary`, `--color-accent`
- Complementary color calculation for blob secondary

### 2b. Audio-Reactive Visualizer
- Rewrite `components/AudioVisualizer.tsx`:
  - Connect to actual AudioContext + AnalyserNode
  - Get real frequency data from audio element
  - Add frequency band analysis: bass (bins 1-8), mid (bins 8-50)
  - Implement smooth attack/release envelope (ATTACK=0.4, RELEASE=0.15)
  - Pass bass/mid values to blob/glow components via context or callback
- Reference: kabaBZ visual.js lines 155-321

### 2c. Fluid Blob Background
- Create `components/FluidBlobs.tsx`
- Two blurred gradient circles driven by audio frequency data
- CSS: `filter: blur(40px) saturate(1.5); mix-blend-mode: screen`
- Idle drift animation (always running) + beat-reactive pulsing
- Update `styles/global.css` with blob styles

### 2d. Border Wave Glow
- Create `components/BorderGlow.tsx`
- Canvas-based animated wave following rounded rectangle border
- Multi-layer stroke (4 layers: wide/blurred → narrow/sharp)
- Reference: kabaBZ visual.js lines 376-490

### 2e. Cover Glow Pulse
- Add glow element behind album cover
- `box-shadow` intensity driven by bass frequency
- Integrates with color extraction for dynamic color

---

## Task 3: Frontend — Player Enhancements (apps/web/src/)

### 3a. Playback State Persistence
- In `stores/playerStore.ts`:
  - Add `restorePlayback()` action: fetch `GET /api/playback-state`, restore queue + position
  - Add debounced `savePlaybackState()`: calls `PUT /api/playback-state` with current state
  - Call save on: song change, queue change, seek, play mode change
  - Call restore on: app init
- Reference: kabaBZ player.js lines 321-337, 456-491

### 3b. Voice/DJ Mode (Web Speech API)
- Create `utils/voiceSynth.ts`:
  - `speak(text: string)` — uses SpeechSynthesis with zh-CN voice
  - Dispatches `voiceStart`/`voiceEnd` custom events
  - Music ducking: player volume → 0.2 during speech, fade back after
- Create `components/VoiceOverlay.tsx`:
  - Full-screen overlay with animated wave canvas
  - Shows spoken text
  - Close button
- Reference: kabaBZ voice.js

### 3c. Cover Flip to Lyrics
- In PlayerPage, add 3D CSS flip animation on cover click
- Front: album art, Back: lyrics panel
- CSS: `perspective: 1000px`, `transform-style: preserve-3d`
- Click toggles `rotateY(180deg)`
- Reference: kabaBZ visual.js lines 142-153

### 3d. Particle Burst Effect
- Create `components/ParticleCanvas.tsx`
- Full-screen canvas, pointer-events none
- `burstParticles(x, y, color)` — 60 particles exploding outward
- Trigger on: song change, favorite toggle, card play click
- Reference: kabaBZ visual.js lines 324-374

---

## Task 4: Config + Integration (apps/web/ + apps/server/)

### 4a. User Config Files
- Create/verify `user/taste.md`, `user/routines.md`, `user/mood-rules.md` with templates
- Create `config/schedule.json` with default time blocks
- Reference: kabaBZ config/taste.md, routines.md, schedule.json

### 4b. Update AI System Prompt
- In `prompts/plan-system.md`:
  - Add `memory` field to output protocol: `{file: "taste|routines|moodrules", add: "one-line insight"}`
  - Add `segue` field for voice commentary
  - Add scene identifiers list

### 4c. Integrate Color Extraction with Player
- Call `extractColors()` on song change event
- Update CSS custom properties so all visual elements respond

### 4d. Wire up Voice Mode
- When AI returns `segue` field, auto-speak it
- Add voice toggle button in player controls
- Connect music ducking events

---

## Execution Plan (Parallel Claude Code)

### CC Instance 1: Backend (Task 1)
Files to create/modify:
- `apps/server/src/helpers/memory-writer.ts` (NEW)
- `apps/server/src/db/playback.repo.ts` (NEW)
- `apps/server/src/db/schema.sql` (MODIFY — add playback_state table)
- `apps/server/src/routes/intent.ts` (MODIFY — dispatch + memory)
- `apps/server/src/routes/player.ts` (MODIFY — playback state API)
- `apps/server/src/routes/now.ts` or new route file (MODIFY — schedule/config API)

### CC Instance 2: Visual Effects (Task 2)
Files to create/modify:
- `apps/web/src/utils/colorExtractor.ts` (NEW)
- `apps/web/src/components/AudioVisualizer.tsx` (REWRITE)
- `apps/web/src/components/FluidBlobs.tsx` (NEW)
- `apps/web/src/components/BorderGlow.tsx` (NEW)
- `apps/web/src/components/CoverGlow.tsx` (NEW)
- `apps/web/src/styles/global.css` (MODIFY — add blob/glow/flip styles)

### CC Instance 3: Player Features (Task 3)
Files to create/modify:
- `apps/web/src/utils/voiceSynth.ts` (NEW)
- `apps/web/src/components/VoiceOverlay.tsx` (NEW)
- `apps/web/src/components/ParticleCanvas.tsx` (NEW)
- `apps/web/src/stores/playerStore.ts` (MODIFY — persistence + voice events)
- `apps/web/src/pages/PlayerPage.tsx` (MODIFY — cover flip + integrate new components)

### CC Instance 4: Config + Integration (Task 4)
Files to create/modify:
- `user/taste.md` (MODIFY — add template content)
- `user/routines.md` (MODIFY — add template content)
- `user/mood-rules.md` (MODIFY — add template content)
- `config/schedule.json` (NEW)
- `apps/server/src/prompts/plan-system.md` (MODIFY — add memory/segue protocol)

## Verification
1. `cd /projects/Claudio && pnpm typecheck` — no TS errors
2. `pnpm dev` — both services start cleanly
3. Play a song → colors change on cover
4. Send chat message → AI can return memory → files updated
5. Reload page → playback state restored
6. Click cover → flips to lyrics
7. AI returns segue → voice speaks with music ducking
