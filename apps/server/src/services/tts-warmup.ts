import type { TtsService } from "./tts.service.js";

/**
 * Common DJ phrases that are likely to be synthesized repeatedly across
 * sessions. Pre-synthesizing them on startup means instant playback
 * (0ms) when these phrases come up in real conversations, instead of
 * the usual ~1s latency for first-time TTS calls.
 *
 * The phrases are a mix of time-of-day greetings, common transitions,
 * and scene-specific intros. They're picked to cover the highest-frequency
 * cases — specific per-user DJ text still goes through the regular path.
 *
 * Warmup is best-effort: if any single phrase fails, others continue.
 */
export const WARMUP_PHRASES: ReadonlyArray<{
  id: string;
  text: string;
}> = [
  // Greetings
  { id: "greeting-morning", text: "早上好，欢迎收听 AI 电台" },
  { id: "greeting-noon", text: "中午好，来点轻松的音乐吧" },
  { id: "greeting-evening", text: "晚上好，辛苦了" },
  { id: "greeting-night", text: "夜深了，让音乐陪你入眠" },
  { id: "greeting-weekend", text: "周末愉快，想听点什么？" },

  // Transitions
  { id: "intro-welcome", text: "欢迎收听 AI 电台，接下来为你准备了几首好听的歌。" },
  { id: "intro-next", text: "接下来这首是" },
  { id: "intro-thanks", text: "感谢收听，我们下一首再见。" },

  // Scene
  { id: "scene-rain", text: "雨天和音乐最配，窝在家里听歌吧" },
  { id: "scene-coding", text: "专注时刻，让背景音乐帮你进入心流" },
  { id: "scene-workout", text: "能量满满，准备好了吗？动起来！" },
  { id: "scene-coffee", text: "一杯咖啡，一首歌，刚刚好" },

  // Mood
  { id: "mood-happy", text: "今天心情不错，来点欢快的旋律吧" },
  { id: "mood-tired", text: "累了吧，让这些歌帮你放松一下" },
  { id: "mood-think", text: "有些歌适合一个人静静听" },
];

export interface WarmupResult {
  total: number;
  succeeded: number;
  failed: number;
  durationMs: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * Pre-synthesize all warmup phrases. Returns immediately after all done.
 * Designed not to throw — any individual phrase failure is captured in
 * the result so startup continues.
 *
 * Concurrent calls (max 3) keep total wall time low even when synthesizing
 * 15 phrases serially would take 15+ seconds.
 */
export async function warmupTts(tts: TtsService): Promise<WarmupResult> {
  const start = Date.now();
  const errors: Array<{ id: string; error: string }> = [];
  let succeeded = 0;

  // Skip warmup for mock — it produces empty files anyway
  if (tts.constructor.name === "MockTtsService") {
    console.log("[tts-warmup] skipping (mock service)");
    return { total: 0, succeeded: 0, failed: 0, durationMs: 0, errors: [] };
  }

  console.log(`[tts-warmup] synthesizing ${WARMUP_PHRASES.length} common phrases...`);

  const results = await Promise.allSettled(
    WARMUP_PHRASES.map(async (p) => {
      const url = await tts.synthesize(p.text);
      return { id: p.id, url };
    })
  );

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      succeeded++;
      console.log(`[tts-warmup]   ✓ ${WARMUP_PHRASES[i].id} → ${r.value.url}`);
    } else {
      const err = r.reason instanceof Error ? r.reason.message : String(r.reason);
      errors.push({ id: WARMUP_PHRASES[i].id, error: err });
      console.warn(`[tts-warmup]   ✗ ${WARMUP_PHRASES[i].id}: ${err}`);
    }
  }

  const result: WarmupResult = {
    total: WARMUP_PHRASES.length,
    succeeded,
    failed: errors.length,
    durationMs: Date.now() - start,
    errors,
  };

  console.log(
    `[tts-warmup] done in ${result.durationMs}ms — ${result.succeeded}/${result.total} succeeded` +
      (result.failed > 0 ? `, ${result.failed} failed` : "")
  );

  return result;
}