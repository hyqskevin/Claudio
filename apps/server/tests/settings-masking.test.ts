import { describe, it, expect } from "vitest";
import {
  isSensitive,
  maskValue,
  maskSensitive,
  MASK_SENTINEL,
  ALLOWED_KEYS,
  SENSITIVE_KEYS,
} from "../src/routes/settings.js";

describe("settings masking", () => {
  it("isSensitive identifies all known secret keys", () => {
    for (const key of SENSITIVE_KEYS) {
      expect(isSensitive(key)).toBe(true);
    }
  });

  it("isSensitive returns false for non-secret keys", () => {
    expect(isSensitive("openweather_city")).toBe(false);
    expect(isSensitive("audio_quality")).toBe(false);
    expect(isSensitive("random_key")).toBe(false);
  });

  it("maskValue replaces secret values with sentinel", () => {
    expect(maskValue("minimax_api_key", "sk-123")).toBe(MASK_SENTINEL);
    expect(maskValue("ncm_cookie", "MUSIC_U=xxx")).toBe(MASK_SENTINEL);
  });

  it("maskValue leaves non-secret values unchanged", () => {
    expect(maskValue("openweather_city", "Shanghai")).toBe("Shanghai");
  });

  it("maskValue does not mask empty secret values", () => {
    expect(maskValue("minimax_api_key", "")).toBe("");
  });

  it("maskSensitive masks all secret keys and preserves others", () => {
    const input = {
      minimax_api_key: "sk-abc",
      kimi_api_key: "sk-def",
      openweather_city: "Shanghai",
      audio_quality: "high",
    };
    const masked = maskSensitive(input);
    expect(masked.minimax_api_key).toBe(MASK_SENTINEL);
    expect(masked.kimi_api_key).toBe(MASK_SENTINEL);
    expect(masked.openweather_city).toBe("Shanghai");
    expect(masked.audio_quality).toBe("high");
  });

  it("ALLOWED_KEYS contains only known configuration keys", () => {
    const knownKeys = [
      "claude_api_key",
      "claude_base_url",
      "claude_model",
      "minimax_api_key",
      "kimi_api_key",
      "ncm_cookie",
      "ncm_uid",
      "netease_cookie",
      "fish_audio_api_key",
      "fish_audio_voice_id",
      "openweather_api_key",
      "openweather_city",
      "feishu_app_id",
      "feishu_app_secret",
      "audio_quality",
      "tts_frequency",
      "spectrum_enabled",
      "ai_language",
      "daily_recommend_enabled",
    ];
    for (const key of knownKeys) {
      expect(ALLOWED_KEYS.has(key)).toBe(true);
    }
  });

  it("ALLOWED_KEYS rejects unknown keys", () => {
    expect(ALLOWED_KEYS.has("malicious_key")).toBe(false);
  });
});
