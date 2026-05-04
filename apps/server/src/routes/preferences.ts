import type { FastifyInstance } from "fastify";
import { getAllSettings, getSetting, setSetting } from "../db/settings.repo.js";

const USER_PREF_KEYS = [
  "theme",
  "language",
  "current_mood",
  "taste_profile",
  "daily_playlist",
  "last_fm_session",
];

export async function preferencesRoutes(app: FastifyInstance) {
  app.get("/api/preferences", async () => {
    const all = getAllSettings();
    const prefs: Record<string, string> = {};
    for (const key of USER_PREF_KEYS) {
      if (all[key] !== undefined) {
        prefs[key] = all[key];
      }
    }
    return prefs;
  });

  app.put("/api/preferences", async (request) => {
    const body = request.body as Record<string, string>;
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string" && USER_PREF_KEYS.includes(key)) {
        setSetting(key, value);
      }
    }
    return { ok: true };
  });

  app.get<{ Params: { key: string } }>("/api/preferences/:key", async (request, reply) => {
    const { key } = request.params;
    if (!USER_PREF_KEYS.includes(key)) {
      reply.code(404);
      return { error: "unknown preference key" };
    }
    const value = getSetting(key);
    return { key, value: value ?? null };
  });
}
