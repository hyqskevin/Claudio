import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { enrichPlanItems } from "../helpers/plan-enrich.js";
import { processMemoryEntries } from "../helpers/memory-writer.js";

const StreamChatSchema = z.object({
    text: z.string().min(1).max(500),
});

// Fast-path command detection (no Claude call needed)
function detectCommand(text: string): { type: string; action?: string; keyword?: string } | null {
    if (text === "播放") return { type: "command", action: "play" };
    if (text.includes("下一首")) return { type: "command", action: "next" };
    if (text.includes("上一首")) return { type: "command", action: "prev" };
    if (text.includes("暂停")) return { type: "command", action: "pause" };
    if (text.includes("随机播放")) return { type: "command", action: "shuffle" };
    if (text.startsWith("搜索")) {
        const keyword = text.replace(/^搜索/, "").trim();
        if (keyword) return { type: "music_search", keyword };
    }
    return null;
}

export async function intentRoutes(app: FastifyInstance) {
    // Original non-streaming endpoint (kept for backward compatibility)
    app.post("/api/intent", async (request) => {
        const { text } = StreamChatSchema.parse(request.body);

        // Fast-path: return commands immediately without calling Claude
        const cmd = detectCommand(text);
        if (cmd) return cmd;

        const { claude, context, ncm, tts } = app.services;

        const contextStr = await context.buildContext(text);
        const plan = await claude.generatePlan(
            { trigger: "manual", input: text, maxSongs: 8, withDj: true },
            contextStr
        );

        // Process memory entries from AI response
        if (Array.isArray(plan.memory) && plan.memory.length > 0) {
            try {
                await processMemoryEntries(plan.memory);
            } catch (err) {
                console.error("[intent] memory write failed:", err);
            }
        }

        const planId = `plan_${Date.now()}`;
        const items = await enrichPlanItems(ncm, tts, plan.items, planId);

        return {
            intent: "GENERATE_PLAN",
            planId,
            scene: plan.scene,
            summary: plan.summary,
            message: `已根据你的指令生成播放计划：${plan.summary}`,
            items,
        };
    });

    // Streaming chat endpoint using SSE
    app.post("/api/chat/stream", async (request, reply) => {
        const { text } = StreamChatSchema.parse(request.body);
        const { claude, context, ncm, tts } = app.services;

        reply.raw.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
        });

        const sendEvent = (event: string, data: unknown) => {
            reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        try {
            const contextStr = await context.buildContext(text);
            sendEvent("status", { phase: "thinking" });

            let plan: Awaited<ReturnType<typeof claude.generatePlanStream>> | null = null;

            plan = await claude.generatePlanStream(
                { trigger: "manual", input: text, maxSongs: 8, withDj: true },
                contextStr,
                (chunk: string) => {
                    sendEvent("chunk", { text: chunk });
                }
            );

            // Process memory entries from AI response
            if (Array.isArray(plan.memory) && plan.memory.length > 0) {
                try {
                    await processMemoryEntries(plan.memory);
                } catch (err) {
                    console.error("[chat/stream] memory write failed:", err);
                }
            }

            // Send plan metadata (including segue for DJ voice)
            sendEvent("plan", {
                scene: plan.scene,
                summary: plan.summary,
                itemCount: plan.items.length,
                songCount: plan.items.filter((i) => i.type === "song").length,
                segue: plan.segue,
            });

            // Now enrich and send songs one by one
            const planId = `plan_${Date.now()}`;
            const enrichedItems = await enrichPlanItems(ncm, tts, plan.items, planId);

            for (const item of enrichedItems) {
                sendEvent("item", item);
            }

            sendEvent("done", { planId, totalItems: enrichedItems.length });
        } catch (err) {
            console.error("[chat/stream] Error:", err);
            sendEvent("error", { message: "抱歉，出了点问题，请再试一次 😅" });
        } finally {
            reply.raw.end();
        }
    });
}
