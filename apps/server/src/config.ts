export interface AppConfig {
  port: number;
  databaseUrl: string;
  /**
   * LLM provider chain. Order matters: tried in sequence on each request,
   * first successful response wins. Set apiKey to enable a provider.
   *
   * Currently supported:
   * - "minimax": MiniMax M3 via Anthropic-compatible API at api.minimaxi.com
   * - "kimi": Moonshot Kimi via OpenAI-compatible API at api.moonshot.cn
   */
  llm: {
    minimax: { apiKey: string; baseUrl: string; model: string };
    kimi: { apiKey: string; baseUrl: string; model: string };
  };
  ncm: {
    apiBaseUrl: string;
    uid: string;
  };
  fishAudio: {
    apiKey: string;
    voiceId: string;
  };
  /**
   * MiniMax TTS — 国内 TTS 服务
   * 文档要求嵌套 voice_setting / audio_setting，
   * 音频以 hex 编码返回（详见 MinimaxTtsService）。
   */
  minimaxTts: {
    apiKey: string;
    voiceId: string;
    model: string;
    endpoint: string;
  };
  openWeather: {
    apiKey: string;
    city: string;
  };
  feishu: {
    appId: string;
    appSecret: string;
  };
}

function env(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(env("SERVER_PORT", "8080")),
    databaseUrl: env("DATABASE_URL", "file:./data/ai-radio.sqlite"),
    llm: {
      minimax: {
        apiKey: env("MINIMAX_API_KEY"),
        baseUrl: env("MINIMAX_BASE_URL", "https://api.minimaxi.com/anthropic"),
        model: env("MINIMAX_MODEL", "MiniMax-M3"),
      },
      kimi: {
        apiKey: env("KIMI_API_KEY"),
        baseUrl: env("KIMI_BASE_URL", "https://api.moonshot.cn/v1"),
        model: env("KIMI_MODEL", "moonshot-v1-8k"),
      },
    },
    ncm: {
      apiBaseUrl: env("NCM_API_BASE_URL", "http://localhost:3000"),
      uid: env("NCM_UID"),
    },
    fishAudio: {
      apiKey: env("FISH_AUDIO_API_KEY"),
      voiceId: env("FISH_AUDIO_VOICE_ID"),
    },
    minimaxTts: {
      apiKey: env("MINIMAX_API_KEY"),
      voiceId: env("MINIMAX_TTS_VOICE_ID", "male-qn-qingse"),
      model: env("MINIMAX_TTS_MODEL", "speech-01-turbo"),
      endpoint: env("MINIMAX_TTS_ENDPOINT", "https://api.minimaxi.com/v1/t2a_v2"),
    },
    openWeather: {
      apiKey: env("OPENWEATHER_API_KEY"),
      city: env("OPENWEATHER_CITY", "Jiangxi"),
    },
    feishu: {
      appId: env("FEISHU_APP_ID"),
      appSecret: env("FEISHU_APP_SECRET"),
    },
  };
}
