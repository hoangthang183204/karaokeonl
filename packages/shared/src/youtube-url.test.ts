import { describe, expect, it } from "vitest";
import { isAllowedThumbnailUrl, isValidYouTubeVideoId, parseYouTubeVideoId } from "./youtube-url";

const ID = "dQw4w9WgXcQ";

describe("parseYouTubeVideoId", () => {
  it("accepts a bare video id", () => {
    expect(parseYouTubeVideoId(ID)).toBe(ID);
    expect(isValidYouTubeVideoId(ID)).toBe(true);
  });

  it("parses common YouTube URL shapes", () => {
    expect(parseYouTubeVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseYouTubeVideoId(`https://youtube.com/watch?v=${ID}&t=30`)).toBe(ID);
    expect(parseYouTubeVideoId(`https://youtu.be/${ID}`)).toBe(ID);
    expect(parseYouTubeVideoId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
    expect(parseYouTubeVideoId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
    expect(parseYouTubeVideoId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseYouTubeVideoId(`https://www.youtube-nocookie.com/embed/${ID}`)).toBe(ID);
  });

  it("rejects other domains, scripts, and malformed ids", () => {
    expect(parseYouTubeVideoId("https://evil.com/embed/" + ID)).toBeNull();
    expect(parseYouTubeVideoId("https://youtube.com.evil.com/watch?v=" + ID)).toBeNull();
    expect(parseYouTubeVideoId("javascript:alert(1)")).toBeNull();
    expect(parseYouTubeVideoId("https://youtu.be/short")).toBeNull();
    expect(parseYouTubeVideoId("https://user:pass@youtube.com/watch?v=" + ID)).toBeNull();
    expect(parseYouTubeVideoId("")).toBeNull();
    expect(isValidYouTubeVideoId("not an id")).toBe(false);
  });

  it("only allows known thumbnail hosts", () => {
    expect(isAllowedThumbnailUrl(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`)).toBe(true);
    expect(isAllowedThumbnailUrl("")).toBe(true);
    expect(isAllowedThumbnailUrl("https://evil.example/thumb.jpg")).toBe(false);
    expect(isAllowedThumbnailUrl("javascript:alert(1)")).toBe(false);
  });
});
