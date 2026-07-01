import type { FastifyInstance } from "fastify";
import { getCurrentItemWithMeta, getQueueItemsWithMeta, serializeQueueItem } from "../db/queue.repo.js";

export function getCurrentState() {
  const nowRow = getCurrentItemWithMeta();
  const queueRows = getQueueItemsWithMeta();
  return {
    nowPlaying: nowRow ? serializeQueueItem(nowRow) : null,
    queue: queueRows.map(serializeQueueItem),
    scene: "default",
    djStatus: "idle" as const,
  };
}

export async function nowRoutes(app: FastifyInstance) {
  app.get("/api/now", async () => {
    return getCurrentState();
  });
}
