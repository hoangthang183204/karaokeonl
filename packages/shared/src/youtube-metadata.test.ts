import { describe, expect, it } from "vitest";
import { applyVideoDetails, classifyYoutubeApiError, mapOEmbed, mapSearchItems, parseIso8601Duration } from "./youtube-metadata";

describe("youtube metadata mapping", () => {
  it("parses ISO durations", () => {
    expect(parseIso8601Duration("PT3M12S")).toBe(192);
    expect(parseIso8601Duration("PT1H")).toBe(3600);
    expect(parseIso8601Duration("nope")).toBeNull();
  });

  it("maps oEmbed and search payloads without inventing titles", () => {
    expect(mapOEmbed("dQw4w9WgXcQ", { title: "Song", author_name: "Channel", thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" })?.title).toBe("Song");
    expect(mapOEmbed("dQw4w9WgXcQ", {})).toBeNull();
    expect(mapOEmbed("bad", { title: "Song" })).toBeNull();

    const hits = mapSearchItems({
      items: [
        { id: { videoId: "dQw4w9WgXcQ" }, snippet: { title: "Song", channelTitle: "Channel", thumbnails: { high: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" } } } },
        { id: { videoId: "short" }, snippet: { title: "Ignored" } },
      ],
    });
    expect(hits).toHaveLength(1);
    const detailed = applyVideoDetails(hits, new Map([["dQw4w9WgXcQ", { durationSec: 192, embeddable: false }]]));
    expect(detailed).toHaveLength(0);
  });

  it("recognizes quota errors", () => {
    expect(classifyYoutubeApiError({ error: { code: 403, message: "quota", errors: [{ reason: "quotaExceeded" }] } })?.kind).toBe("quota");
    expect(classifyYoutubeApiError({ items: [] })).toBeNull();
  });
});
