import { describe, it, expect } from "vitest";
import { detectCommand, detectSearch } from "../src/routes/dispatch.js";

describe("dispatch command detection", () => {
  it("detects 'next' command variants", () => {
    const cmd = detectCommand("下一首");
    expect(cmd).not.toBeNull();
    expect(cmd?.type).toBe("command");
    expect(cmd?.action).toBe("next");

    expect(detectCommand("切歌")?.action).toBe("next");
    expect(detectCommand("next")?.action).toBe("next");
  });

  it("detects 'prev' command variants", () => {
    expect(detectCommand("上一首")?.action).toBe("prev");
    expect(detectCommand("previous")?.action).toBe("prev");
  });

  it("detects 'pause' command", () => {
    const cmd = detectCommand("暂停");
    expect(cmd?.action).toBe("pause");
    expect(cmd?.message).toBe("已暂停");
  });

  it("detects 'play' command", () => {
    const cmd = detectCommand("播放");
    expect(cmd?.action).toBe("play");
  });

  it("detects 'shuffle' command", () => {
    expect(detectCommand("随机")?.action).toBe("shuffle");
    expect(detectCommand("随机播放")?.action).toBe("shuffle");
    expect(detectCommand("shuffle")?.action).toBe("shuffle");
  });

  it("detects 'repeat' command", () => {
    expect(detectCommand("循环")?.action).toBe("repeat");
    expect(detectCommand("单曲循环")?.action).toBe("repeat");
  });

  it("returns null for non-commands", () => {
    expect(detectCommand("推荐一些歌")).toBeNull();
    expect(detectCommand("今天天气怎么样")).toBeNull();
  });
});

describe("dispatch search detection", () => {
  it("detects search with '搜索' prefix", () => {
    expect(detectSearch("搜索 周杰伦")).toBe("周杰伦");
  });

  it("detects search with '播放' prefix", () => {
    expect(detectSearch("播放 晴天")).toBe("晴天");
  });

  it("detects search with '找' prefix", () => {
    expect(detectSearch("找 摇滚")).toBe("摇滚");
  });

  it("detects search with '来一首' prefix", () => {
    expect(detectSearch("来一首 民谣")).toBe("民谣");
  });

  it("detects search with '...的歌' suffix", () => {
    expect(detectSearch("周杰伦的歌")).toBe("周杰伦");
  });

  it("returns null for recommendation messages", () => {
    expect(detectSearch("推荐")).toBeNull();
    expect(detectSearch("推荐一些摇滚")).toBeNull();
  });

  it("returns null for non-search messages", () => {
    expect(detectSearch("今天天气怎么样")).toBeNull();
  });
});
