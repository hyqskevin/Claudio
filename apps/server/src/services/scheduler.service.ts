import cron, { type ScheduledTask } from "node-cron";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ClaudeService } from "./claude.service.js";
import type { ContextService } from "./context.service.js";
import { setSetting, getSetting } from "../db/settings.repo.js";
import { getRecentPlays, getFavorites } from "../db/plays.repo.js";
import { getRecentMessages } from "../db/messages.repo.js";

export type TaskName = "morning-plan" | "weather-refresh" | "cache-check" | "history-consolidate" | "daily-playlist" | "mood-check" | "taste-profile";

export interface TaskStatus {
  name: TaskName;
  cron: string;
  lastRun: string | null;
  lastResult: "ok" | "error" | null;
  lastError: string | null;
}

export interface SchedulerService {
  start(): void;
  stop(): void;
  getStatus(): TaskStatus[];
  trigger(taskName: TaskName): Promise<void>;
}

export class MockSchedulerService implements SchedulerService {
  private statuses: TaskStatus[] = [];

  start(): void {
    console.log("[scheduler] mock scheduler started");
  }

  stop(): void {
    console.log("[scheduler] mock scheduler stopped");
  }

  getStatus(): TaskStatus[] {
    return this.statuses;
  }

  async trigger(_taskName: TaskName): Promise<void> {
    console.log("[scheduler] mock trigger ignored");
  }
}

export class CronSchedulerService implements SchedulerService {
  private tasks: ScheduledTask[] = [];
  private claude: ClaudeService;
  private context: ContextService;
  private statuses: Map<TaskName, TaskStatus> = new Map();

  constructor(deps: { claude: ClaudeService; context: ContextService }) {
    this.claude = deps.claude;
    this.context = deps.context;
  }

  private recordResult(name: TaskName, cron: string, ok: boolean, error?: string) {
    this.statuses.set(name, {
      name,
      cron,
      lastRun: new Date().toISOString(),
      lastResult: ok ? "ok" : "error",
      lastError: error ?? null,
    });
  }

  getStatus(): TaskStatus[] {
    return Array.from(this.statuses.values());
  }

  async trigger(taskName: TaskName): Promise<void> {
    switch (taskName) {
      case "morning-plan":
        await this.runMorningPlan();
        break;
      case "weather-refresh":
        await this.runWeatherRefresh();
        break;
      case "cache-check":
        await this.runCacheCheck();
        break;
      case "daily-playlist":
        await this.runDailyPlaylist();
        break;
      case "mood-check":
        await this.runMoodCheck();
        break;
      case "taste-profile":
        await this.runTasteProfile();
        break;
      case "history-consolidate":
        break;
    }
  }

  private async runMorningPlan() {
    const cron = "0 7 * * *";
    try {
      console.log("[scheduler] generating morning plan...");
      const contextStr = await this.context.buildContext("生成早晨播放计划", "morning");
      const plan = await this.claude.generatePlan(
        { trigger: "scheduled", maxSongs: 8, withDj: true, scene: "morning" },
        contextStr
      );
      console.log(`[scheduler] morning plan generated: ${plan.summary}`);
      this.recordResult("morning-plan", cron, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[scheduler] morning plan failed:", msg);
      this.recordResult("morning-plan", cron, false, msg);
    }
  }

  private async runWeatherRefresh() {
    const cron = "0 9 * * *";
    try {
      console.log("[scheduler] refreshing weather and calendar...");
      await this.context.buildContext();
      console.log("[scheduler] context refreshed");
      this.recordResult("weather-refresh", cron, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[scheduler] context refresh failed:", msg);
      this.recordResult("weather-refresh", cron, false, msg);
    }
  }

  private async runCacheCheck() {
    const cron = "0 * * * *";
    const CACHE_THRESHOLD_MB = 500;
    try {
      const cacheDir = join(process.cwd(), "cache");
      let totalBytes = 0;
      const entries = await readdir(cacheDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const s = await stat(join(cacheDir, entry.name));
          totalBytes += s.size;
        } else if (entry.isDirectory()) {
          const subEntries = await readdir(join(cacheDir, entry.name));
          for (const sub of subEntries) {
            const s = await stat(join(cacheDir, entry.name, sub));
            if (s.isFile()) totalBytes += s.size;
          }
        }
      }
      const sizeMB = Math.round(totalBytes / 1024 / 1024);
      if (sizeMB > CACHE_THRESHOLD_MB) {
        console.warn(`[scheduler] cache size ${sizeMB}MB exceeds threshold ${CACHE_THRESHOLD_MB}MB`);
      } else {
        console.log(`[scheduler] cache size: ${sizeMB}MB`);
      }
      this.recordResult("cache-check", cron, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[scheduler] cache check failed:", msg);
      this.recordResult("cache-check", cron, false, msg);
    }
  }

  private async runDailyPlaylist() {
    const cron = "0 7 * * *";
    try {
      console.log("[scheduler] generating daily playlist...");
      const recentPlays = getRecentPlays(20);
      const favorites = getFavorites();
      const playSummary = recentPlays.map((p) => `${p.title ?? "?"} - ${p.artist ?? "?"}`).join(", ");
      const favSummary = favorites.slice(0, 10).map((f) => `${f.title ?? "?"} - ${f.artist ?? "?"}`).join(", ");

      const prompt = `根据用户最近播放和收藏，生成今日推荐歌单（8首歌）。

最近播放: ${playSummary || "无"}
收藏歌曲: ${favSummary || "无"}

请返回JSON格式: { "name": "每日推荐", "description": "...", "songs": [{ "title": "...", "artist": "..." }] }`;

      const contextStr = await this.context.buildContext(prompt, "daily-playlist");
      const plan = await this.claude.generatePlan(
        { trigger: "scheduled", maxSongs: 8, withDj: false, scene: "daily-playlist" },
        contextStr
      );
      setSetting("daily_playlist", JSON.stringify(plan));
      console.log("[scheduler] daily playlist generated");
      this.recordResult("daily-playlist", cron, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[scheduler] daily playlist failed:", msg);
      this.recordResult("daily-playlist", cron, false, msg);
    }
  }

  private async runMoodCheck() {
    const cron = "0 * * * *";
    try {
      console.log("[scheduler] checking mood...");
      const recentMessages = getRecentMessages(10);
      const chatSummary = recentMessages.map((m) => `[${m.role}] ${m.content}`).join("\n");
      const recentPlays = getRecentPlays(5);
      const playSummary = recentPlays.map((p) => `${p.title ?? "?"} (${p.scene ?? "unknown"})`).join(", ");

      const prompt = `根据以下信息判断用户当前情绪，返回一个情绪标签（如：放松、兴奋、忧伤、专注、疲惫、快乐）。

最近聊天:
${chatSummary || "无"}

最近播放: ${playSummary || "无"}

只返回JSON: { "mood": "情绪标签", "confidence": 0.8 }`;

      const contextStr = await this.context.buildContext(prompt, "mood-check");
      const plan = await this.claude.generatePlan(
        { trigger: "scheduled", maxSongs: 0, withDj: false, scene: "mood-check" },
        contextStr
      );
      setSetting("current_mood", JSON.stringify(plan));
      console.log("[scheduler] mood updated");
      this.recordResult("mood-check", cron, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[scheduler] mood check failed:", msg);
      this.recordResult("mood-check", cron, false, msg);
    }
  }

  private async runTasteProfile() {
    const cron = "0 6 * * *";
    try {
      console.log("[scheduler] generating taste profile...");
      const favorites = getFavorites();
      const recentPlays = getRecentPlays(50);
      const favSummary = favorites.map((f) => `${f.title ?? "?"} - ${f.artist ?? "?"}`).join(", ");
      const playSummary = recentPlays.map((p) => `${p.title ?? "?"} - ${p.artist ?? "?"}`).join(", ");

      const prompt = `以DJ口吻为用户生成品味画像总结。

收藏歌曲: ${favSummary || "无"}
最近播放: ${playSummary || "无"}

请返回JSON: { "profile": "用DJ口吻写的品味总结（200字以内）", "topGenres": ["genre1", "genre2"], "moodKeywords": ["keyword1", "keyword2"] }`;

      const contextStr = await this.context.buildContext(prompt, "taste-profile");
      const plan = await this.claude.generatePlan(
        { trigger: "scheduled", maxSongs: 0, withDj: false, scene: "taste-profile" },
        contextStr
      );
      setSetting("taste_profile", JSON.stringify(plan));
      console.log("[scheduler] taste profile updated");
      this.recordResult("taste-profile", cron, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[scheduler] taste profile failed:", msg);
      this.recordResult("taste-profile", cron, false, msg);
    }
  }

  start(): void {
    // 07:00 生成早间计划
    this.tasks.push(cron.schedule("0 7 * * *", () => this.runMorningPlan()));

    // 09:00 刷新天气和日程
    this.tasks.push(cron.schedule("0 9 * * *", () => this.runWeatherRefresh()));

    // 每小时检查缓存大小
    this.tasks.push(cron.schedule("0 * * * *", () => this.runCacheCheck()));

    // 06:00 品味画像生成
    this.tasks.push(cron.schedule("0 6 * * *", () => this.runTasteProfile()));

    // 07:00 每日歌单推荐
    this.tasks.push(cron.schedule("0 7 * * *", () => this.runDailyPlaylist()));

    // 每小时情绪检查
    this.tasks.push(cron.schedule("30 * * * *", () => this.runMoodCheck()));

    // 每天凌晨整理播放历史
    this.tasks.push(
      cron.schedule("0 0 * * *", () => {
        console.log("[scheduler] consolidating play history...");
        this.recordResult("history-consolidate", "0 0 * * *", true);
      })
    );

    console.log("[scheduler] cron scheduler started with 7 jobs");
  }

  stop(): void {
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
    console.log("[scheduler] cron scheduler stopped");
  }
}
