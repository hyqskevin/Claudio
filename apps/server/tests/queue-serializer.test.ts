import { describe, it, expect } from "vitest";
import { serializeQueueItem } from "../src/db/queue.repo.js";
import type { QueueItemWithMeta } from "../src/db/queue.repo.js";

describe("queue serializer", () => {
  const baseRow: QueueItemWithMeta = {
    id: "qi-1",
    plan_id: "plan-1",
    type: "song",
    song_id: "123456",
    title: "晴天",
    artist: "周杰伦",
    cover_url: "https://p1.music.126.net/cover.jpg",
    tts_text: null,
    audio_url: "https://music.163.com/song/media/outer/url?id=123456",
    reason: "适合写代码",
    sort_order: 0,
    status: "pending",
  };

  it("converts snake_case to camelCase for all known fields", () => {
    const item = serializeQueueItem(baseRow);
    expect(item.songId).toBe("123456");
    expect(item.audioUrl).toBe("https://music.163.com/song/media/outer/url?id=123456");
    expect(item.coverUrl).toBe("https://p1.music.126.net/cover.jpg");
    expect(item.text).toBeUndefined(); // tts_text is null, mapped to undefined
  });

  it("preserves title, artist, and coverUrl from row metadata", () => {
    const item = serializeQueueItem(baseRow);
    expect(item.title).toBe("晴天");
    expect(item.artist).toBe("周杰伦");
    expect(item.coverUrl).toBe("https://p1.music.126.net/cover.jpg");
  });

  it("handles TTS items without song metadata", () => {
    const ttsRow: QueueItemWithMeta = {
      ...baseRow,
      id: "qi-2",
      type: "tts",
      song_id: null,
      title: null,
      artist: null,
      cover_url: null,
      tts_text: "欢迎来到音乐电台",
      audio_url: "https://tts.example.com/audio.mp3",
      reason: null,
    };
    const item = serializeQueueItem(ttsRow);
    expect(item.type).toBe("tts");
    expect(item.songId).toBeUndefined();
    expect(item.title).toBeUndefined();
    expect(item.artist).toBeUndefined();
    expect(item.coverUrl).toBeUndefined();
    expect(item.text).toBe("欢迎来到音乐电台");
    expect(item.audioUrl).toBe("https://tts.example.com/audio.mp3");
  });

  it("omits undefined fields when metadata is null", () => {
    const emptyRow: QueueItemWithMeta = {
      id: "qi-3",
      plan_id: null,
      type: "song",
      song_id: null,
      title: null,
      artist: null,
      cover_url: null,
      tts_text: null,
      audio_url: null,
      reason: null,
      sort_order: 1,
      status: "failed",
    };
    const item = serializeQueueItem(emptyRow);
    expect(item.songId).toBeUndefined();
    expect(item.title).toBeUndefined();
    expect(item.artist).toBeUndefined();
    expect(item.coverUrl).toBeUndefined();
    expect(item.audioUrl).toBeUndefined();
    expect(item.text).toBeUndefined();
    expect(item.reason).toBeUndefined();
  });

  it("always includes id, type, and status", () => {
    const item = serializeQueueItem(baseRow);
    expect(item.id).toBe("qi-1");
    expect(item.type).toBe("song");
    expect(item.status).toBe("pending");
  });
});
