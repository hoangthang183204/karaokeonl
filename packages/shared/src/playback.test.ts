import { describe, expect, it } from "vitest";
import { driftSeconds, expectedPlaybackTime, shouldIgnoreDrift, shouldSeek } from "./playback";
import { estimateClockOffset, planPlaybackSync } from "./sync-plan";
import { LIMITS } from "./types";

const base = {
  playbackState: "playing" as const,
  anchorTime: 30,
  updatedAt: 1_000_000,
  duration: 200,
  currentVideoId: "dQw4w9WgXcQ",
  songSessionId: "session-1",
};

describe("playback clock", () => {
  it("advances from the anchor while playing and freezes while paused", () => {
    expect(expectedPlaybackTime(base, base.updatedAt + 10_000)).toBe(40);
    expect(expectedPlaybackTime({ ...base, playbackState: "paused" }, base.updatedAt + 10_000)).toBe(30);
  });

  it("does not seek on small drift and seeks past the threshold", () => {
    expect(shouldIgnoreDrift(driftSeconds(40.2, 40))).toBe(true);
    expect(shouldSeek(driftSeconds(40, 42))).toBe(true);
    expect(LIMITS.seekThresholdSec).toBeGreaterThan(LIMITS.ignoreDriftSec);
  });

  it("plans a load for a new viewer and a seek when the clock is far off", () => {
    const load = planPlaybackSync({
      remote: base,
      localVideoId: null,
      localTime: 0,
      localStatus: "unstarted",
      autoplayBlocked: false,
      nowMs: base.updatedAt + 10_000,
    });
    expect(load).toEqual({ type: "load", videoId: base.currentVideoId, startSeconds: 40, autoplay: true });

    const seek = planPlaybackSync({
      remote: base,
      localVideoId: base.currentVideoId,
      localTime: 20,
      localStatus: "playing",
      autoplayBlocked: false,
      nowMs: base.updatedAt + 10_000,
    });
    expect(seek).toEqual({ type: "seek", time: 40 });
  });

  it("waits for a gesture when the browser blocks autoplay", () => {
    const plan = planPlaybackSync({
      remote: base,
      localVideoId: base.currentVideoId,
      localTime: 40,
      localStatus: "paused",
      autoplayBlocked: true,
      nowMs: base.updatedAt + 10_000,
    });
    expect(plan.type).toBe("wait-gesture");
  });

  it("does not fight the player while it is buffering", () => {
    const plan = planPlaybackSync({
      remote: base,
      localVideoId: base.currentVideoId,
      localTime: 10,
      localStatus: "buffering",
      autoplayBlocked: false,
      nowMs: base.updatedAt + 10_000,
    });
    expect(plan.type).toBe("none");
  });

  it("uses the median clock sample", () => {
    expect(estimateClockOffset([100, -20, 10, 400, 12])).toBe(12);
  });
});
