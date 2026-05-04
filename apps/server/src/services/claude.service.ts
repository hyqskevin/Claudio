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

export class MockClaudeService implements ClaudeService {
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

export class ClaudeApiService implements ClaudeService {
    private apiKey: string;
    private baseUrl: string;
    private model: string;
    private systemPrompt: string;

    private chatSystemPrompt: string;

    constructor(config: { apiKey: string; baseUrl: string; model: string }, systemPrompt: string) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl;
        this.model = config.model;
        this.systemPrompt = systemPrompt;
        this.chatSystemPrompt = this.buildChatSystemPrompt();
    }

    private buildChatSystemPrompt(): string {
        // Base prompt — agent.md is loaded lazily in generateChatReplyStream
        return `你是 Claudio，一个沉浸式 AI 电台的 DJ。

## 回复格式
你必须以 JSON 格式回复，不要添加任何其他文字：

{
  "say": "回复给用户的消息文本（DJ 口吻，轻松有趣）",
  "reason": "推荐理由（如果有推荐歌曲的话）",
  "play": [
    {"id": "歌曲ID", "name": "歌曲名", "artist": "艺术家", "album": "专辑名", "cover": "封面URL"}
  ],
  "segue": "要用 TTS 朗读的语音内容（歌曲故事、冷知识等）"
}

## 规则
- say: 必填，回复给用户的文字，简洁有力
- reason: 可选，推荐理由
- play: 可选，推荐的歌曲列表（3-8首）
- segue: 可选，DJ 语音播报内容（1-3句话）
- 使用 DJ 口吻，轻松有趣，偶尔中英混搭
- 歌曲信息尽量准确，歌手+歌名要具体
- 如果用户只是闲聊，play 可以为空数组`;
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
            } catch (err) {
                console.error("[claude] Attempt", attempt, "failed:", err);
                if (attempt === 1) break;
            }
        }

        if (!rawResponse) {
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
     */
    async generatePlanStream(
        request: PlanRequest,
        context: string,
        onChunk: (text: string) => void
    ): Promise<PlanResponse> {
        const userMessage = this.buildUserMessage(request, context);
        let fullText = "";

        try {
            fullText = await this.callClaudeStream(userMessage, onChunk);
        } catch (err) {
            console.error("[claude-stream] Streaming failed, falling back to sync:", err);
            return this.generatePlan(request, context);
        }

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
