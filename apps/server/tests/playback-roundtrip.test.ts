import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { closeDb } from "../src/db/db.js";
import {
  getPlaybackState,
  updatePlaybackState,
} from "../src/db/playback.repo.js";
import { unlinkSync } from "node:fs";

function useTempDb() {
  const path = `/tmp/ai-radio-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`;
  process.env.DATABASE_URL = `file:${path}`;
  closeDb();
  return {
    path,
    cleanup() {
      closeDb();
      try { unlinkSync(path); } catch {}
      try { unlinkSync(path + "-shm"); } catch {}
      try { unlinkSync(path + "-wal"); } catch {}
    },
  };
}

describe("playback state round-trip", () => {
  let dbCtx: ReturnType<typeof useTempDb>;

  beforeEach(() => {
    dbCtx = useTempDb();
  });

  afterEach(() => {
    dbCtx.cleanup();
  });

  it("writes and reads playMode and shuffle correctly", () => {
    updatePlaybackState({
      playMode: "all",
      shuffle: true,
      progressSeconds: 120,
    });

    const state = getPlaybackState();
    expect(state.playMode).toBe("all");
    expect(state.shuffle).toBe(true);
    expect(state.progressSeconds).toBe(120);
  });

  it("preserves other fields during partial update", () => {
    updatePlaybackState({
      currentSongId: "123",
      currentSongName: "Test Song",
      currentSongArtist: "Test Artist",
      playMode: "one",
    });

    updatePlaybackState({ shuffle: false });

    const state = getPlaybackState();
    expect(state.currentSongId).toBe("123");
    expect(state.currentSongName).toBe("Test Song");
    expect(state.currentSongArtist).toBe("Test Artist");
    expect(state.playMode).toBe("one");
    expect(state.shuffle).toBe(false);
  });

  it("round-trips shuffle as boolean despite number storage", () => {
    updatePlaybackState({ shuffle: true });
    let state = getPlaybackState();
    expect(state.shuffle).toBe(true);

    updatePlaybackState({ shuffle: false });
    state = getPlaybackState();
    expect(state.shuffle).toBe(false);
  });

  it("returns default values for fresh database", () => {
    const state = getPlaybackState();
    expect(state.currentSongId).toBeNull();
    expect(state.currentSongName).toBeNull();
    expect(state.currentSongArtist).toBeNull();
    expect(state.progressSeconds).toBe(0);
    expect(state.queueIndex).toBe(0);
    expect(state.playMode).toBe("off");
    expect(state.shuffle).toBe(false);
  });
});
