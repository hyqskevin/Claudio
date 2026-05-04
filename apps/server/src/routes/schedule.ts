import type { FastifyInstance } from "fastify";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const projectRoot = resolve(import.meta.dirname, "../../../..");
const schedulePath = resolve(projectRoot, "config/schedule.json");

async function readJsonFile(path: string, fallback: unknown): Promise<unknown> {
    try {
        const content = await readFile(path, "utf-8");
        return JSON.parse(content);
    } catch {
        return fallback;
    }
}

async function readTextFile(path: string): Promise<string> {
    try {
        return await readFile(path, "utf-8");
    } catch {
        return "";
    }
}

export async function scheduleRoutes(app: FastifyInstance) {
    app.get("/api/schedule", async () => {
        return readJsonFile(schedulePath, []);
    });

    app.post("/api/schedule", async (request) => {
        const body = request.body;
        await mkdir(dirname(schedulePath), { recursive: true });
        await writeFile(schedulePath, JSON.stringify(body, null, 2), "utf-8");
        return { ok: true };
    });

    app.get("/api/user-config", async () => {
        const [taste, routines, moodRules] = await Promise.all([
            readTextFile(resolve(projectRoot, "user/taste.md")),
            readTextFile(resolve(projectRoot, "user/routines.md")),
            readTextFile(resolve(projectRoot, "user/mood-rules.md")),
        ]);
        return { taste, routines, moodRules };
    });
}
