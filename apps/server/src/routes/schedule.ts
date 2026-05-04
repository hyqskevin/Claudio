import type { FastifyInstance } from "fastify";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { getSetting } from "../db/settings.repo.js";
import type { TaskName } from "../services/scheduler.service.js";

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

const VALID_TASKS: TaskName[] = [
    "morning-plan",
    "weather-refresh",
    "cache-check",
    "history-consolidate",
    "daily-playlist",
    "mood-check",
    "taste-profile",
];

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

    // 调度器状态
    app.get("/api/scheduler/status", async () => {
        const scheduler = app.services.scheduler;
        return { tasks: scheduler.getStatus() };
    });

    // 今日推荐歌单
    app.get("/api/scheduler/daily-playlist", async () => {
        const raw = getSetting("daily_playlist");
        if (!raw) return { playlist: null };
        try {
            return { playlist: JSON.parse(raw) };
        } catch {
            return { playlist: raw };
        }
    });

    // 当前情绪
    app.get("/api/scheduler/mood", async () => {
        const raw = getSetting("current_mood");
        if (!raw) return { mood: null };
        try {
            return { mood: JSON.parse(raw) };
        } catch {
            return { mood: raw };
        }
    });

    // 品味画像
    app.get("/api/scheduler/taste-profile", async () => {
        const raw = getSetting("taste_profile");
        if (!raw) return { profile: null };
        try {
            return { profile: JSON.parse(raw) };
        } catch {
            return { profile: raw };
        }
    });

    // 手动触发任务
    app.post<{ Params: { task: string } }>("/api/scheduler/trigger/:task", async (request, reply) => {
        const { task } = request.params;
        if (!VALID_TASKS.includes(task as TaskName)) {
            reply.code(400);
            return { error: `unknown task: ${task}`, validTasks: VALID_TASKS };
        }
        const scheduler = app.services.scheduler;
        await scheduler.trigger(task as TaskName);
        return { ok: true, task };
    });
}
