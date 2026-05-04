import type { FastifyInstance } from "fastify";
import { getPlaybackState, updatePlaybackState, type PlaybackState } from "../db/playback.repo.js";

export async function playbackStateRoutes(app: FastifyInstance) {
  app.get("/api/playback-state", async () => {
    return getPlaybackState();
  });

  app.put<{ Body: Partial<PlaybackState> }>("/api/playback-state", async (request) => {
    updatePlaybackState(request.body);
    return { ok: true };
  });
}
