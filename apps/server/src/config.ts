export interface AppConfig {
  port: number;
  databaseUrl: string;
  claude: {
    apiKey: string;
    baseUrl: string;
    model: string;
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
    claude: {
      apiKey: env("CLAUDE_API_KEY"),
      baseUrl: env("CLAUDE_BASE_URL", "https://api.anthropic.com"),
      model: env("CLAUDE_MODEL", "claude-sonnet-4-20250514"),
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
