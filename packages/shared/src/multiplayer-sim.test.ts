import { describe, expect, it } from "vitest";
import { expectedPlaybackTime } from "./playback";
import { planPlaybackSync } from "./sync-plan";
import { applyCommand, createRoomState } from "./tv-engine";
import { LIMITS, type Actor, type TVState } from "./types";

const VIDEO = {
  videoId: "abcdefghijk",
  title: "Bai dong bo",
  thumbnail: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
  channelTitle: "Kenh",
  durationSec: 240,
};

function actor(index: number, role: Actor["role"] = "member"): Actor {
  return { userId: `user-${index}`, role, displayName: `Nguoi ${index}` };
}

/**
 * Mô phỏng logic: nhiều client đọc cùng một TVState và tự tính thời gian.
 * Đây không phải bài đo tải mạng 20–50 CCU trên server thật.
 */
function simulate(count: number) {
  const host = actor(0, "host");
  let state = createRoomState({ roomId: "roomsim1", hostId: host.userId, nowMs: 5_000_000 });
  const played = applyCommand(state, {
    type: "play-now",
    actor: host,
    requestId: "sim-play1",
    expectedRevision: 0,
    nowMs: 5_000_000,
    video: VIDEO,
  });
  state = played.state;
  const serverNow = state.updatedAt + 10_000;
  const expected = expectedPlaybackTime(state, serverNow);

  const views = Array.from({ length: count }, (_, index) => {
    const skewMs = ((index % 7) - 3) * 80;
    const clientNow = serverNow + skewMs;
    const localExpected = expectedPlaybackTime(state, clientNow);
    const plan = planPlaybackSync({
      remote: state,
      localVideoId: index % 4 === 0 ? null : state.currentVideoId,
      localTime: localExpected,
      localStatus: index % 4 === 0 ? "unstarted" : "playing",
      autoplayBlocked: false,
      nowMs: clientNow,
    });
    return { videoId: state.currentVideoId, playbackState: state.playbackState, localExpected, plan, skewMs };
  });

  return { state, expected, views };
}

describe("multiplayer playback consistency", () => {
  it.each([2, 5, 10, 20])("keeps %i logical clients on the same video and playback state", (count) => {
    const { views, expected } = simulate(count);
    expect(new Set(views.map((view) => view.videoId)).size).toBe(1);
    expect(new Set(views.map((view) => view.playbackState)).size).toBe(1);
    for (const view of views) {
      const drift = Math.abs(view.localExpected - expected);
      expect(drift).toBeCloseTo(Math.abs(view.skewMs) / 1000, 5);
      expect(drift).toBeLessThan(LIMITS.seekThresholdSec);
      if (view.plan.type === "load") {
        expect(view.plan.videoId).toBe(VIDEO.videoId);
        expect(Math.abs(view.plan.startSeconds - view.localExpected)).toBeLessThan(0.01);
      } else {
        expect(view.plan.type === "none" || view.plan.type === "seek").toBe(true);
      }
    }
  });

  it("asks a client with multi-second skew to seek instead of pretending frame lock", () => {
    const host = actor(0, "host");
    let state: TVState = createRoomState({ roomId: "roomsim1", hostId: host.userId, nowMs: 5_000_000 });
    state = applyCommand(state, {
      type: "play-now",
      actor: host,
      requestId: "sim-play2",
      expectedRevision: 0,
      nowMs: 5_000_000,
      video: VIDEO,
    }).state;
    const now = state.updatedAt + 12_000;
    const expected = expectedPlaybackTime(state, now);
    const plan = planPlaybackSync({
      remote: state,
      localVideoId: state.currentVideoId,
      localTime: expected - 3,
      localStatus: "playing",
      autoplayBlocked: false,
      nowMs: now,
    });
    expect(plan.type).toBe("seek");
    expect(LIMITS.seekThresholdSec).toBeLessThan(3);
  });
});
