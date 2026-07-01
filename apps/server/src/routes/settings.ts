import type { FastifyInstance } from "fastify";
import { getAllSettings, setSetting } from "../db/settings.repo.js";

const SENSITIVE_KEYS = [
  "minimax_api_key",
  "kimi_api_key",
  "claude_api_key",
  "fish_audio_api_key",
  "openweather_api_key",
  "feishu_app_secret",
  "ncm_cookie",
  "netease_cookie",
];

const MASK_SENTINEL = "***已配置***";

const ALLOWED_KEYS = new Set([
  // Claude / LLM
  "claude_api_key",
  "claude_base_url",
  "claude_model",
  "minimax_api_key",
  "kimi_api_key",
  // NCM
  "ncm_cookie",
  "ncm_uid",
  "netease_cookie",
  // TTS
  "fish_audio_api_key",
  "fish_audio_voice_id",
  // Weather
  "openweather_api_key",
  "openweather_city",
  // Calendar
  "feishu_app_id",
  "feishu_app_secret",
  // Audio / UI
  "audio_quality",
  "tts_frequency",
  "spectrum_enabled",
  "ai_language",
  "daily_recommend_enabled",
]);

export function isSensitive(key: string): boolean {
  return SENSITIVE_KEYS.includes(key);
}

export function maskValue(key: string, value: string): string {
  if (isSensitive(key) && value) {
    return MASK_SENTINEL;
  }
  return value;
}

export function maskSensitive(settings: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(settings)) {
    masked[key] = maskValue(key, value);
  }
  return masked;
}

export { MASK_SENTINEL, ALLOWED_KEYS, SENSITIVE_KEYS };

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/api/settings", async () => {
    const settings = getAllSettings();
    return maskSensitive(settings);
  });

  app.put("/api/settings", async (request) => {
    const body = request.body as Record<string, string>;
    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_KEYS.has(key)) {
        console.warn(`[settings] Ignoring unknown key: ${key}`);
        continue;
      }
      if (typeof value !== "string") {
        continue;
      }
      // Do not overwrite secrets with mask sentinel or empty strings
      if (isSensitive(key) && (!value || value === MASK_SENTINEL)) {
        continue;
      }
      setSetting(key, value);
    }
    return { ok: true };
  });
}
