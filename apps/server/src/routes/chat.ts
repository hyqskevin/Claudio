import type { FastifyInstance } from "fastify";
import { getRecentMessages, insertMessage } from "../db/messages.repo.js";

export async function chatRoutes(app: FastifyInstance) {
  app.get("/api/chat/messages", async (request) => {
    const { limit } = request.query as { limit?: string };
    const rows = getRecentMessages(limit ? parseInt(limit, 10) : 50);
    // Return in chronological order (oldest first)
    const messages = rows.reverse().map((r) => {
      let songs: unknown[] | undefined;
      let structured: unknown | undefined;
      if (r.meta) {
        try {
          const parsed = JSON.parse(r.meta);
          // Handle new format: { songs, structured }
          if (parsed && typeof parsed === "object" && "songs" in parsed) {
            songs = parsed.songs;
            structured = parsed.structured;
          } else if (Array.isArray(parsed)) {
            // Legacy format: meta was the songs array directly
            songs = parsed;
          }
        } catch {}
      }
      return {
        id: r.id,
        role: r.role,
        text: r.content,
        ts: new Date(r.created_at).getTime(),
        songs,
        structured,
      };
    });
    return { messages };
  });

  app.post<{ Body: { id: string; role: string; text: string; meta?: unknown } }>(
    "/api/chat/messages",
    async (request, reply) => {
      const { id, role, text, meta } = request.body;
      if (!id || !role || !text) {
        reply.code(400);
        return { error: "id, role, text are required" };
      }
      insertMessage({
        id,
        role,
        content: text,
        meta: meta ? JSON.stringify(meta) : undefined,
      });
      return { ok: true };
    }
  );
}
