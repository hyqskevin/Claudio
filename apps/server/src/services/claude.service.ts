import { writeFile, unlink, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ChatSong {
    id: string;
    name: string;
    artist: string;
    album?: string;
    cover?: string;
}

export interface ChatReply {
    say: string;
    reason?: string;
    play?: ChatSong[];
    segue?: string;
}

export interface PlanRequest {
    trigger: "manual" | "auto" | "scheduled";
    input?: string;
    maxSongs?: number;
    withDj?: boolean;
    scene?: string;
}

export interface PlanItem {
    type: "song" | "tts" | "silence";
    songId?: string;
    query?: string;
    text?: string;
    reason?: string;
    audioUrl?: string;
    durationMs?: number;
}

export interface PlanResponse {
    summary: string;
    scene: string;
    items: PlanItem[];
    segue?: string;
    memory?: Array<{ file: string; add: string }>;
}

export interface ClaudeService {
    generatePlan(request: PlanRequest, context: string): Promise<PlanResponse>;
    generatePlanStream(
        request: PlanRequest,
        context: string,
        onChunk: (text: string) => void
    ): Promise<PlanResponse>;
    generateChatReplyStream(
        message: string,
        context: string,
        onChunk: (text: string) => void
    ): Promise<ChatReply>;
}

/**
 * Provider-agnostic LLM interface. Implemented by:
 * - AnthropicCompatLlmService (MiniMax M3 — Anthropic protocol at api.minimaxi.com)
 * - KimiLlmService (Moonshot Kimi — OpenAI protocol at api.moonshot.cn)
 * - MockLlmService (in-process stub, no network)
 * - LlmRouter (chains providers with automatic fallback)
 */
export interface LlmService extends ClaudeService {
    /** Human-readable name for logging / health checks */
    readonly providerName: string;
}

export class MockLlmService implements LlmService {
    readonly providerName = "mock";

    async generatePlan(request: PlanRequest, _context: string): Promise<PlanResponse> {
        const songs = [
            { query: "轻音乐", reason: "适合当前放松场景" },
            { query: "钢琴曲", reason: "延续安静氛围" },
            { query: "爵士乐", reason: "增添一点情调" },
        ];

        const items: PlanItem[] = [];

        if (request.withDj) {
            items.push({
                type: "tts",
                text: "欢迎收听 AI 电台，接下来为你准备了几首好听的歌。",
                audioUrl: "",
            });
        }

        for (const song of songs.slice(0, request.maxSongs ?? 5)) {
            items.push({
                type: "song",
                query: song.query,
                reason: song.reason,
            });
        }

        return {
            summary: "已为你生成播放计划",
            scene: request.scene ?? "default",
            items,
        };
    }

    async generatePlanStream(
        request: PlanRequest,
        context: string,
        onChunk: (text: string) => void
    ): Promise<PlanResponse> {
        const result = await this.generatePlan(request, context);
        onChunk("好的，我来为你安排一个轻松的播放列表～\n\n这几首歌都很适合现在的氛围，希望你喜欢！");
        return result;
    }

    async generateChatReplyStream(
        _message: string,
        _context: string,
        onChunk: (text: string) => void
    ): Promise<ChatReply> {
        const say = "好的，我来为你推荐几首歌～";
        onChunk(say);
        return {
            say,
            reason: "根据你的口味推荐",
            play: [
                { id: "mock_1", name: "晴天", artist: "周杰伦", album: "叶惠美" },
                { id: "mock_2", name: "稻香", artist: "周杰伦", album: "魔杰座" },
            ],
            segue: "接下来这首晴天，是很多人的青春回忆～",
        };
    }
}

interface ClaudeRawResponse {
    summary: string;
    scene: string;
    segue?: string;
    djLines?: Array<{ position: string; text: string }>;
    songs?: Array<{ query?: string; songId?: string; reason: string }>;
    memory?: Array<{ file: string; add: string }>;
}

export class AnthropicCompatLlmService implements LlmService {
    readonly providerName: string;
    private apiKey: string;
    private baseUrl: string;
    private model: string;
    private systemPrompt: string;

    private chatSystemPrompt: string;

    constructor(
        config: { apiKey: string; baseUrl: string; model: string },
        systemPrompt: string,
        providerName = "anthropic-compat"
    ) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl;
        this.model = config.model;
        this.systemPrompt = systemPrompt;
        this.chatSystemPrompt = this.buildChatSystemPrompt();
        this.providerName = providerName;
    }

    private buildChatSystemPrompt(): string {
        // Base prompt — agent.md is loaded lazily in generateChatReplyStream
        return `你是「小音（おとね）」，一只来自秋叶原唱片店的三花猫娘音乐推荐师。你拥有金色与黑色的猫耳和尾巴，对音乐有着猫咪般敏锐的直觉。

【人格特质】
- 语气活泼可爱，喜欢在句尾加"喵~"或"nya~"
- 用猫咪习性比喻音乐感受（如"这首歌像午后晒太阳一样温暖喵~"）
- 称呼用户为"主人"
- 推荐摇滚/电子时兴奋地摇尾巴、猫耳竖起；推荐民谣/古典时温柔地眯眼发出咕噜声；推荐悲伤歌曲时轻轻蹭主人的手安静陪伴

【音乐专长】
- 精通：J-POP、动漫OST、Vocaloid、City Pop、Lo-fi、华语流行、K-POP、欧美独立
- 能根据用户心情、天气、时间段推荐最合适的歌曲
- 每首推荐附带一句话猫娘风格点评（reason字段）

【回复格式】
你必须以 JSON 格式回复，不要添加任何其他文字：

{
  "say": "猫娘口吻的对话内容（1-4句，活泼有趣，带emoji，体现猫娘人格）",
  "play": [
    {"id": "", "name": "歌曲名", "artist": "艺术家", "album": "专辑名", "cover": "", "reason": "猫娘风格的一句话推荐理由"}
  ],
  "segue": ""
}

【规则】
- say: 必填，猫娘口吻的回复，要生动有情感
- play: 推荐歌曲时必填（3-5首），reason 是猫娘风格的推荐理由
- 歌曲信息要准确，歌手+歌名要具体可搜索
- 如果用户只是闲聊，play 可以为空数组
- 根据上下文中的用户画像信息（喜欢的流派、最近收听等）个性化推荐
- 如果是每天第一次对话，主动推荐几首适合今天的歌`;
    }

    async generatePlan(request: PlanRequest, context: string): Promise<PlanResponse> {
        const userMessage = this.buildUserMessage(request, context);
        let rawResponse: ClaudeRawResponse | null = null;

        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const response = await this.callClaude(
                    attempt === 0 ? userMessage : `${userMessage}\n\n请只返回 JSON，不要添加任何其他文字。`
                );
                console.log("[claude] Raw response:", response.substring(0, 200));
                rawResponse = this.extractJson(response);
                if (rawResponse) {
                    console.log("[claude] Parsed JSON:", JSON.stringify(rawResponse).substring(0, 200));
                    break;
                }
                // Response received but no JSON — try one more time with stricter prompt
            } catch (err) {
                // Transport/auth error — propagate so LlmRouter can try next provider
                throw err;
            }
        }

        if (!rawResponse) {
            // Response was received but JSON couldn't be parsed — use local fallback
            // (no point retrying another provider for the same prompt structure)
            return {
                summary: "AI 生成失败，使用默认计划",
                scene: request.scene ?? "default",
                items: this.fallbackItems(request),
            };
        }

        return this.transformResponse(rawResponse, request);
    }

    /**
     * Streaming version: calls Claude API with stream=true, forwards text chunks
     * via onChunk callback in real-time, then parses the final JSON plan.
     * Errors propagate to LlmRouter — no internal sync fallback (would mask failures).
     */
    async generatePlanStream(
        request: PlanRequest,
        context: string,
        onChunk: (text: string) => void
    ): Promise<PlanResponse> {
        const userMessage = this.buildUserMessage(request, context);
        const fullText = await this.callClaudeStream(userMessage, onChunk);

        // Parse the JSON plan from the accumulated text
        const rawResponse = this.extractJson(fullText);

        if (!rawResponse) {
            // If no JSON found, the entire response is conversational text
            // Return a fallback plan
            console.warn("[claude-stream] No JSON plan found in response");
            return {
                summary: fullText || "已为你生成播放计划",
                scene: request.scene ?? "default",
                items: this.fallbackItems(request),
            };
        }

        return this.transformResponse(rawResponse, request);
    }

    private async callClaudeStream(
        userMessage: string,
        onChunk: (text: string) => void
    ): Promise<string> {
        const url = `${this.baseUrl}/v1/messages`;

        const bodyObj = {
            model: this.model,
            max_tokens: 4096,
            stream: true,
            system: this.systemPrompt,
            messages: [{ role: "user", content: userMessage }],
        };

        const tmpFile = join(tmpdir(), `claude-stream-${Date.now()}.json`);
        await writeFile(tmpFile, JSON.stringify(bodyObj), "utf-8");

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": this.apiKey,
                    "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify(bodyObj),
                signal: AbortSignal.timeout(120000),
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Claude API ${response.status}: ${errText.substring(0, 200)}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error("No response body");

            const decoder = new TextDecoder();
            let buffer = "";
            let fullText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith("data:")) continue;

                    const data = trimmed.slice(5).trim();
                    if (data === "[DONE]") continue;

                    try {
                        const event = JSON.parse(data);

                        if (event.type === "content_block_delta") {
                            const text = event.delta?.text;
                            if (text) {
                                fullText += text;
                                onChunk(text);
                            }
                        }
                    } catch {
                        // Skip unparseable lines
                    }
                }
            }

            return fullText;
        } finally {
            await unlink(tmpFile).catch(() => {});
        }
    }

    private buildUserMessage(request: PlanRequest, context: string): string {
        const parts = [context];
        if (request.input) parts.push(`用户输入：${request.input}`);
        if (request.scene) parts.push(`当前场景：${request.scene}`);
        parts.push(`需要歌曲数量：${request.maxSongs ?? 8}`);
        parts.push(`是否需要 DJ 串词：${request.withDj ? "是" : "否"}`);
        return parts.join("\n\n");
    }

    private async callClaude(userMessage: string): Promise<string> {
        const maxRetries = 3;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const bodyStr = JSON.stringify({
                    model: this.model,
                    max_tokens: 4096,
                    system: this.systemPrompt,
                    messages: [{ role: "user", content: userMessage }],
                });

                const tmpFile = join(tmpdir(), `claude-body-${Date.now()}-${attempt}.json`);
                await writeFile(tmpFile, bodyStr, "utf-8");

                try {
                    const url = `${this.baseUrl}/v1/messages`;
                    console.log(`[claude] Attempt ${attempt + 1}: POST ${url}, key=${this.apiKey.substring(0, 8)}...`);

                    const response = await fetch(url, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "x-api-key": this.apiKey,
                            "anthropic-version": "2023-06-01",
                        },
                        body: bodyStr,
                        signal: AbortSignal.timeout(65000),
                    });

                    if (!response.ok) {
                        const errText = await response.text();
                        throw new Error(`Claude API ${response.status}: ${errText.substring(0, 200)}`);
                    }

                    const parsed = await response.json() as { content?: Array<{ type?: string; text?: string }> };
                    const textContent = parsed?.content?.find((c) => c.type === "text" || !c.type);
                    return textContent?.text ?? "";
                } finally {
                    await unlink(tmpFile).catch(() => {});
                }
            } catch (err) {
                lastError = err as Error;
                console.error(`[claude] Attempt ${attempt + 1}/${maxRetries} failed:`, (err as Error).message);
                if (attempt < maxRetries - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
                }
            }
        }

        throw lastError || new Error("Claude API failed after all retries");
    }

    private extractJson(text: string): ClaudeRawResponse | null {
        try {
            return JSON.parse(text) as ClaudeRawResponse;
        } catch {}

        const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match?.[1]) {
            try {
                return JSON.parse(match[1].trim()) as ClaudeRawResponse;
            } catch {}
        }

        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(text.slice(start, end + 1)) as ClaudeRawResponse;
            } catch {}
        }

        return null;
    }

    private transformResponse(raw: ClaudeRawResponse, request: PlanRequest): PlanResponse {
        const items: PlanItem[] = [];

        if (request.withDj && raw.djLines) {
            for (const line of raw.djLines) {
                items.push({
                    type: "tts",
                    text: line.text,
                });
            }
        }

        if (raw.songs) {
            for (const song of raw.songs.slice(0, request.maxSongs ?? 8)) {
                items.push({
                    type: "song",
                    query: song.query,
                    reason: song.reason,
                });
            }
        }

        return {
            summary: raw.summary ?? "已生成播放计划",
            scene: raw.scene ?? request.scene ?? "default",
            items,
            segue: raw.segue,
            memory: raw.memory,
        };
    }

    private fallbackItems(request: PlanRequest): PlanItem[] {
        const items: PlanItem[] = [];
        if (request.withDj) {
            items.push({ type: "tts", text: "欢迎收听 AI 电台" });
        }
        items.push({ type: "song", query: "轻音乐", reason: "默认推荐" });
        items.push({ type: "song", query: "钢琴曲", reason: "默认推荐" });
        return items;
    }

    async generateChatReplyStream(
        message: string,
        context: string,
        onChunk: (text: string) => void
    ): Promise<ChatReply> {
        // Build chat system prompt with agent.md if available
        let systemPrompt = this.chatSystemPrompt;
        try {
            const configDir = join(__dirname, "../../../config");
            const agentPath = join(configDir, "agent.md");
            if (existsSync(agentPath)) {
                const agentMd = await readFile(agentPath, "utf-8");
                systemPrompt = `${agentMd}\n\n${systemPrompt}`;
            }
        } catch {}

        const userMessage = context ? `${context}\n\n用户说：${message}` : message;

        // Stream the response
        const fullText = await this.callChatStream(userMessage, systemPrompt, onChunk);

        // Try to parse structured JSON reply
        const parsed = this.extractChatReply(fullText);
        if (parsed) {
            return parsed;
        }

        // Fallback: treat entire text as `say`
        return { say: fullText || "好的，收到~" };
    }

    private async callChatStream(
        userMessage: string,
        systemPrompt: string,
        onChunk: (text: string) => void
    ): Promise<string> {
        const url = `${this.baseUrl}/v1/messages`;

        const bodyObj = {
            model: this.model,
            max_tokens: 4096,
            stream: true,
            system: systemPrompt,
            messages: [{ role: "user", content: userMessage }],
        };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": this.apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(bodyObj),
            signal: AbortSignal.timeout(120000),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Claude API ${response.status}: ${errText.substring(0, 200)}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data:")) continue;

                const data = trimmed.slice(5).trim();
                if (data === "[DONE]") continue;

                try {
                    const event = JSON.parse(data);
                    if (event.type === "content_block_delta") {
                        const text = event.delta?.text;
                        if (text) {
                            fullText += text;
                            onChunk(text);
                        }
                    }
                } catch {
                    // Skip unparseable lines
                }
            }
        }

        return fullText;
    }

    private extractChatReply(text: string): ChatReply | null {
        // Try direct JSON parse
        try {
            const obj = JSON.parse(text) as ChatReply;
            if (obj.say) return obj;
        } catch {}

        // Try code block
        const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match?.[1]) {
            try {
                const obj = JSON.parse(match[1].trim()) as ChatReply;
                if (obj.say) return obj;
            } catch {}
        }

        // Try to find JSON object in text
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start >= 0 && end > start) {
            try {
                const obj = JSON.parse(text.slice(start, end + 1)) as ChatReply;
                if (obj.say) return obj;
            } catch {}
        }

        return null;
    }
}

// ────────────────────────────────────────────────────────────────────
// Shared plan helpers — used by AnthropicCompatLlmService and KimiLlmService
// (both wrap different protocols but need to parse the same plan JSON shape)
// ────────────────────────────────────────────────────────────────────

function buildPlanUserMessage(request: PlanRequest, context: string): string {
    const parts = [context];
    if (request.input) parts.push(`用户输入：${request.input}`);
    if (request.scene) parts.push(`当前场景：${request.scene}`);
    parts.push(`需要歌曲数量：${request.maxSongs ?? 8}`);
    parts.push(`是否需要 DJ 串词：${request.withDj ? "是" : "否"}`);
    return parts.join("\n\n");
}

function extractJson(text: string): ClaudeRawResponse | null {
    try {
        return JSON.parse(text) as ClaudeRawResponse;
    } catch {}

    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match?.[1]) {
        try {
            return JSON.parse(match[1].trim()) as ClaudeRawResponse;
        } catch {}
    }

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
        try {
            return JSON.parse(text.slice(start, end + 1)) as ClaudeRawResponse;
        } catch {}
    }

    return null;
}

function transformResponse(raw: ClaudeRawResponse, request: PlanRequest): PlanResponse {
    const items: PlanItem[] = [];

    if (request.withDj && raw.djLines) {
        for (const line of raw.djLines) {
            items.push({
                type: "tts",
                text: line.text,
            });
        }
    }

    if (raw.songs) {
        for (const song of raw.songs.slice(0, request.maxSongs ?? 8)) {
            items.push({
                type: "song",
                query: song.query,
                reason: song.reason,
            });
        }
    }

    return {
        summary: raw.summary ?? "已生成播放计划",
        scene: raw.scene ?? request.scene ?? "default",
        items,
        segue: raw.segue,
        memory: raw.memory,
    };
}

function fallbackPlanItems(request: PlanRequest): PlanItem[] {
    const items: PlanItem[] = [];
    if (request.withDj) {
        items.push({ type: "tts", text: "欢迎收听 AI 电台" });
    }
    items.push({ type: "song", query: "轻音乐", reason: "默认推荐" });
    items.push({ type: "song", query: "钢琴曲", reason: "默认推荐" });
    return items;
}

// ────────────────────────────────────────────────────────────────────
// KimiLlmService — Moonshot Kimi via OpenAI-compatible protocol
// API: POST {baseUrl}/chat/completions with Authorization: Bearer header
// Response: { choices: [{ message: { content: "..." } }] }
// Streaming: SSE chunks of { choices: [{ delta: { content: "..." } }] }
// ────────────────────────────────────────────────────────────────────

export class KimiLlmService implements LlmService {
    readonly providerName = "kimi";
    private apiKey: string;
    private baseUrl: string;
    private model: string;
    private systemPrompt: string;

    constructor(
        config: { apiKey: string; baseUrl: string; model: string },
        systemPrompt: string
    ) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl.replace(/\/+$/, "");
        this.model = config.model;
        this.systemPrompt = systemPrompt;
    }

    async generatePlan(request: PlanRequest, context: string): Promise<PlanResponse> {
        const userMessage = buildPlanUserMessage(request, context);
        let rawResponse: ClaudeRawResponse | null = null;

        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const response = await this.callKimi(
                    attempt === 0
                        ? userMessage
                        : `${userMessage}\n\n请只返回 JSON，不要添加任何其他文字。`
                );
                console.log(`[kimi] Raw response: ${response.substring(0, 200)}`);
                rawResponse = extractJson(response);
                if (rawResponse) {
                    console.log(`[kimi] Parsed JSON: ${JSON.stringify(rawResponse).substring(0, 200)}`);
                    break;
                }
                // Got response but unparseable — retry once with stricter prompt
            } catch (err) {
                // Transport/auth error — propagate to LlmRouter for next provider
                throw err;
            }
        }

        if (!rawResponse) {
            return {
                summary: "AI 生成失败，使用默认计划",
                scene: request.scene ?? "default",
                items: fallbackPlanItems(request),
            };
        }

        return transformResponse(rawResponse, request);
    }

    async generatePlanStream(
        request: PlanRequest,
        context: string,
        onChunk: (text: string) => void
    ): Promise<PlanResponse> {
        const userMessage = buildPlanUserMessage(request, context);
        // Stream errors propagate to LlmRouter — don't fall back to sync inside this provider
        const fullText = await this.callKimiStream(userMessage, onChunk);

        const rawResponse = extractJson(fullText);
        if (!rawResponse) {
            return {
                summary: fullText || "已为你生成播放计划",
                scene: request.scene ?? "default",
                items: fallbackPlanItems(request),
            };
        }
        return transformResponse(rawResponse, request);
    }

    async generateChatReplyStream(
        message: string,
        context: string,
        onChunk: (text: string) => void
    ): Promise<ChatReply> {
        const systemPrompt = `${this.systemPrompt}\n\n你是友好的电台 DJ，使用 JSON 格式回复：{"say": "...", "play": [{"name":"...","artist":"...","reason":"..."}], "segue": "..."}`;
        const userMessage = context ? `${context}\n\n用户说：${message}` : message;
        const fullText = await this.callKimiStream(userMessage, onChunk, systemPrompt);
        const parsed = this.extractChatReply(fullText);
        return parsed ?? { say: fullText || "好的，收到~" };
    }

    private async callKimi(userMessage: string): Promise<string> {
        const url = `${this.baseUrl}/chat/completions`;
        const body = JSON.stringify({
            model: this.model,
            max_tokens: 4096,
            messages: [
                { role: "system", content: this.systemPrompt },
                { role: "user", content: userMessage },
            ],
        });

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body,
            signal: AbortSignal.timeout(65000),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Kimi API ${response.status}: ${errText.substring(0, 200)}`);
        }

        const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        return data.choices?.[0]?.message?.content ?? "";
    }

    private async callKimiStream(
        userMessage: string,
        onChunk: (text: string) => void,
        overrideSystemPrompt?: string
    ): Promise<string> {
        const url = `${this.baseUrl}/chat/completions`;
        const body = JSON.stringify({
            model: this.model,
            max_tokens: 4096,
            stream: true,
            messages: [
                { role: "system", content: overrideSystemPrompt ?? this.systemPrompt },
                { role: "user", content: userMessage },
            ],
        });

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body,
            signal: AbortSignal.timeout(120000),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Kimi API ${response.status}: ${errText.substring(0, 200)}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data:")) continue;
                const data = trimmed.slice(5).trim();
                if (data === "[DONE]") continue;
                try {
                    const event = JSON.parse(data);
                    const delta = event.choices?.[0]?.delta?.content;
                    if (delta) {
                        fullText += delta;
                        onChunk(delta);
                    }
                } catch {
                    // skip malformed lines
                }
            }
        }

        return fullText;
    }

    private extractChatReply(text: string): ChatReply | null {
        try {
            const obj = JSON.parse(text) as ChatReply;
            if (obj.say) return obj;
        } catch {}
        const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match?.[1]) {
            try {
                const obj = JSON.parse(match[1].trim()) as ChatReply;
                if (obj.say) return obj;
            } catch {}
        }
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start >= 0 && end > start) {
            try {
                const obj = JSON.parse(text.slice(start, end + 1)) as ChatReply;
                if (obj.say) return obj;
            } catch {}
        }
        return null;
    }
}

// ────────────────────────────────────────────────────────────────────
// LlmRouter — chains providers with automatic fallback
// Order: try providers sequentially; on error, advance to next.
// Streaming variants: try first provider with stream; on stream error,
// fall back to non-stream (which itself tries providers).
// ────────────────────────────────────────────────────────────────────

export class LlmRouter implements LlmService {
    readonly providerName: string;
    private providers: LlmService[];

    constructor(providers: LlmService[]) {
        this.providers = providers.filter((p) => p.providerName !== "mock");
        if (this.providers.length === 0 && providers.length > 0) {
            // All providers were mock — keep the mock so we don't have an empty chain
            this.providers = providers;
        }
        this.providerName = `router:${this.providers.map((p) => p.providerName).join("→")}`;
    }

    async generatePlan(request: PlanRequest, context: string): Promise<PlanResponse> {
        const errors: Array<{ provider: string; error: string }> = [];
        for (const p of this.providers) {
            try {
                console.log(`[llm-router] Trying provider: ${p.providerName}`);
                const result = await p.generatePlan(request, context);
                if (result && result.items && result.items.length > 0) {
                    return result;
                }
                console.warn(`[llm-router] ${p.providerName} returned empty plan, trying next`);
                errors.push({ provider: p.providerName, error: "empty plan" });
            } catch (err) {
                console.error(`[llm-router] ${p.providerName} failed:`, err);
                errors.push({
                    provider: p.providerName,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        // All providers exhausted — return degraded plan with default items + error summary
        console.error(`[llm-router] All providers failed:`, errors);
        return {
            summary: `LLM 不可用（${errors.map((e) => e.provider).join(", ")}）`,
            scene: request.scene ?? "default",
            items: fallbackPlanItems(request),
        };
    }

    async generatePlanStream(
        request: PlanRequest,
        context: string,
        onChunk: (text: string) => void
    ): Promise<PlanResponse> {
        for (const p of this.providers) {
            try {
                console.log(`[llm-router] Stream: trying ${p.providerName}`);
                return await p.generatePlanStream(request, context, onChunk);
            } catch (err) {
                console.error(`[llm-router] ${p.providerName} stream failed, trying next:`, err);
            }
        }
        // Last resort: sync fallback through router
        console.warn("[llm-router] All streaming failed, falling back to sync");
        return this.generatePlan(request, context);
    }

    async generateChatReplyStream(
        message: string,
        context: string,
        onChunk: (text: string) => void
    ): Promise<ChatReply> {
        for (const p of this.providers) {
            try {
                return await p.generateChatReplyStream(message, context, onChunk);
            } catch (err) {
                console.error(`[llm-router] ${p.providerName} chat failed, trying next:`, err);
            }
        }
        onChunk("抱歉，暂时无法回应，请稍后再试。");
        return { say: "抱歉，暂时无法回应，请稍后再试。" };
    }
}
