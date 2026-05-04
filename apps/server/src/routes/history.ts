import type { FastifyInstance } from "fastify";
import { getRecentPlays, recordPlay } from "../db/plays.repo.js";
import { randomUUID } from "node:crypto";

export async function historyRoutes(app: FastifyInstance) {
  app.get("/api/history", async (request) => {
    const { limit, offset } = request.query as { limit?: string; offset?: string };
    const limitNum = Math.min(parseInt(limit ?? "50", 10), 200);
    const offsetNum = parseInt(offset ?? "0", 10);
    const rows = getRecentPlays(limitNum + offsetNum);
    return { items: rows.slice(offsetNum), total: rows.length };
  });

  app.post<{ Body: { songId: string; songName?: string; artist?: string; album?: string; coverUrl?: string; scene?: string } }>(
    "/api/history",
    async (request, reply) => {
      const { songId, songName, artist, album, coverUrl, scene } = request.body;
      if (!songId) {
        reply.code(400);
        return { error: "songId is required" };
      }
      const id = randomUUID();
      recordPlay({ id, itemId: songId, itemType: "song", songId, action: "play", scene });
      return { ok: true, id };
    }
  );
}
