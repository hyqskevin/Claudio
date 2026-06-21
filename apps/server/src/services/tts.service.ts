import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, "../../cache/tts");

export interface TtsService {
  synthesize(text: string): Promise<string>;
}

export class MockTtsService implements TtsService {
  constructor() {
    mkdirSync(CACHE_DIR, { recursive: true });
  }

  async synthesize(text: string): Promise<string> {
    const hash = createHash("sha256").update(text).digest("hex").slice(0, 16);
    const filename = `${hash}.mp3`;
    const filepath = join(CACHE_DIR, filename);

    if (existsSync(filepath)) {
      return `/api/media/tts/${hash}`;
    }

    writeFileSync(filepath, Buffer.alloc(0));
    return `/api/media/tts/${hash}`;
  }
}

export class FishTtsService implements TtsService {
  private apiKey: string;
  private voiceId: string;
  private cacheDir: string;

  constructor(config: { apiKey: string; voiceId: string }) {
    this.apiKey = config.apiKey;
    this.voiceId = config.voiceId;
    this.cacheDir = CACHE_DIR;
    mkdirSync(this.cacheDir, { recursive: true });
  }

  async synthesize(text: string): Promise<string> {
    if (text.length > 200) {
      text = text.slice(0, 200);
    }

    const hash = createHash("sha256").update(text).digest("hex").slice(0, 16);
    const filename = `${hash}.mp3`;
    const filepath = join(this.cacheDir, filename);

    if (existsSync(filepath) && readFileSync(filepath).length > 0) {
      return `/api/media/tts/${hash}`;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      const body: Record<string, unknown> = {
        text,
        reference_id: this.voiceId,
        format: "mp3",
        mp3_bitrate: 128,
        normalize: true,
        latency: "normal",
      };

      const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
      const url = "https://api.fish.audio/v1/tts";
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      };
      const bodyStr = JSON.stringify(body);

      let res: Response;
      if (proxyUrl) {
        const { ProxyAgent, fetch: undiciFetch } = await import("undici");
        res = await undiciFetch(url, {
          method: "POST",
          headers,
          body: bodyStr,
          signal: controller.signal,
          dispatcher: new ProxyAgent(proxyUrl),
        }) as unknown as Response;
      } else {
        res = await fetch(url, {
          method: "POST",
          headers,
          body: bodyStr,
          signal: controller.signal,
        });
      }

      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`Fish Audio API ${res.status}: ${res.statusText}`);
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      writeFileSync(filepath, buffer);
      return `/api/media/tts/${hash}`;
    } catch (err) {
      console.error("[tts] Fish Audio failed:", err);
      return "";
    }
  }
}

export class MinimaxTtsService implements TtsService {
  private apiKey: string;
  private voiceId: string;
  private model: string;
  private endpoint: string;
  private cacheDir: string;

  constructor(config: { apiKey: string; voiceId: string; model?: string; endpoint?: string }) {
    this.apiKey = config.apiKey;
    this.voiceId = config.voiceId;
    this.model = config.model ?? "speech-01-turbo";
    this.endpoint = config.endpoint ?? "https://api.minimaxi.com/v1/t2a_v2";
    this.cacheDir = CACHE_DIR;
    mkdirSync(this.cacheDir, { recursive: true });
  }

  async synthesize(text: string): Promise<string> {
    // MiniMax 单次请求最多 10000 字符；与 Fish 一致保守截断到 500
    if (text.length > 500) {
      text = text.slice(0, 500);
    }

    const hash = createHash("sha256").update(text + "|" + this.voiceId).digest("hex").slice(0, 16);
    const filename = `${hash}.mp3`;
    const filepath = join(this.cacheDir, filename);

    if (existsSync(filepath) && readFileSync(filepath).length > 0) {
      return `/api/media/tts/${hash}`;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      const body = {
        model: this.model,
        text,
        stream: false,
        output_format: "hex",
        voice_setting: {
          voice_id: this.voiceId,
          speed: 1.0,
          vol: 1.0,
          pitch: 0,
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: "mp3",
          channel: 1,
        },
      };

      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`MiniMax TTS API ${res.status}: ${res.statusText}`);
      }

      const json = (await res.json()) as {
        base_resp?: { status_code: number; status_msg: string };
        data?: { audio?: string; status?: number; ced?: string };
      };

      // MiniMax 在 HTTP 200 但业务失败时也会返回 status_code != 0
      if (json.base_resp && json.base_resp.status_code !== 0) {
        throw new Error(
          `MiniMax TTS business error ${json.base_resp.status_code}: ${json.base_resp.status_msg}`
        );
      }

      const audioHex = json.data?.audio;
      if (!audioHex) {
        throw new Error("MiniMax TTS response missing data.audio");
      }

      // data.audio 是 hex 编码的 MP3 二进制
      const buffer = Buffer.from(audioHex, "hex");
      writeFileSync(filepath, buffer);
      return `/api/media/tts/${hash}`;
    } catch (err) {
      console.error("[tts] MiniMax failed:", err);
      return "";
    }
  }
}
