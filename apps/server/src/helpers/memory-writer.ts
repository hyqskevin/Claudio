import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const MEMORY_MAP: Record<string, string> = {
    taste: "user/taste.md",
    routines: "user/routines.md",
    moodrules: "user/mood-rules.md",
};

const projectRoot = resolve(import.meta.dirname, "../../../..");

export async function processMemoryEntries(
    memory: Array<{ file: string; add: string }>
): Promise<void> {
    for (const entry of memory) {
        const relPath = MEMORY_MAP[entry.file];
        if (!relPath || !entry.add) continue;

        const filePath = resolve(projectRoot, relPath);
        try {
            await mkdir(dirname(filePath), { recursive: true });
            await appendFile(filePath, `\n- ${entry.add.trim()}`, "utf-8");
            console.log(`[memory] wrote to ${relPath}: ${entry.add.trim()}`);
        } catch (err) {
            console.error(`[memory] failed to write ${relPath}:`, err);
        }
    }
}
