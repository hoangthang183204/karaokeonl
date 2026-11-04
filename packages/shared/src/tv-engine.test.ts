import { describe, expect, it } from "vitest";
import { chooseNextHost } from "./host-migration";
import { RateLimiter } from "./rate-limit";
import { expectedPlaybackTime } from "./playback";
import {
  applyCommand,
  createRoomState,
  migrateHost,
  tickPlayback,
  type TvCommand,
} from "./tv-engine";
import type { Actor, MemberRef, ResolvedVideo, TVState } from "./types";

const NOW = 1_700_000_000_000;
const VIDEO_A: ResolvedVideo = {
  videoId: "abcdefghijk",
  title: "Bai A",
  thumbnail: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
  channelTitle: "Kenh A",
  durationSec: 90,
};
const VIDEO_B: ResolvedVideo = {
  ...VIDEO_A,
  videoId: "bcdefghijkl",
  title: "Bai B",
  thumbnail: "https://i.ytimg.com/vi/bcdefghijkl/hqdefault.jpg",
  durationSec: 120,
};
const VIDEO_C: ResolvedVideo = {
  ...VIDEO_A,
  videoId: "cdefghijklm",
  title: "Bai C",
  thumbnail: "https://i.ytimg.com/vi/cdefghijklm/hqdefault.jpg",
  durationSec: 100,
};

const host: Actor = { userId: "host", role: "host", displayName: "Host" };
const cohost: Actor = { userId: "cohost", role: "cohost", displayName: "Co" };
const member: Actor = { userId: "member", role: "member", displayName: "Mem" };

function room(): TVState {
  return createRoomState({ roomId: "abc12345", hostId: host.userId, nowMs: NOW });
}

function run(state: TVState, command: TvCommand) {
  const result = applyCommand(state, command);
  expect(result.ok, result.error?.code).toBe(true);
  return result.state;
}

describe("tv engine", () => {
  it("lets the host play, pause, resume, and seek", () => {
    let state = room();
    state = run(state, { type: "play-now", actor: host, requestId: "play-0001", expectedRevision: 0, nowMs: NOW, video: VIDEO_A });
    expect(state.currentVideoId).toBe(VIDEO_A.videoId);
    expect(state.playbackState).toBe("playing");
    expect(state.duration).toBe(90);
    expect(state.revision).toBe(1);

    const pausedAt = NOW + 15_000;
    state = run(state, { type: "pause", actor: host, requestId: "pause001", expectedRevision: state.revision, nowMs: pausedAt });
    expect(state.playbackState).toBe("paused");
    expect(state.anchorTime).toBe(15);

    state = run(state, { type: "resume", actor: host, requestId: "resume01", expectedRevision: state.revision, nowMs: pausedAt + 5000 });
    expect(state.playbackState).toBe("playing");
    expect(expectedPlaybackTime(state, pausedAt + 10_000)).toBe(20);

    state = run(state, { type: "seek", actor: host, requestId: "seek0001", expectedRevision: state.revision, nowMs: pausedAt + 10_000, time: 40 });
    expect(state.anchorTime).toBe(40);
    expect(state.playbackState).toBe("playing");
  });

  it("lets a member queue a song, play it, and pause it", () => {
    let state = room();
    state = run(state, { type: "play-now", actor: member, requestId: "play-0002", expectedRevision: 0, nowMs: NOW, video: VIDEO_A });
    expect(state.playbackState).toBe("playing");
    expect(state.currentVideoId).toBe(VIDEO_A.videoId);
    state = run(state, { type: "add-song", actor: member, requestId: "add-00001", nowMs: NOW + 1000, video: VIDEO_B });
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0].requestedBy).toBe(member.userId);
    expect(state.queue[0].status).toBe("waiting");

    const paused = applyCommand(state, { type: "pause", actor: member, requestId: "pause002", expectedRevision: state.revision, nowMs: NOW + 2000 });
    expect(paused.ok).toBe(true);
    expect(paused.state.playbackState).toBe("paused");

    const changed = applyCommand(paused.state, { type: "next", actor: member, requestId: "next0009", expectedRevision: paused.state.revision, nowMs: NOW + 3000 });
    expect(changed.ok).toBe(true);
    expect(changed.state.currentVideoId).toBe(VIDEO_B.videoId);
  });

  it("advances the queue, restores previous, and clears waiting songs", () => {
    let state = room();
    state = run(state, { type: "add-song", actor: member, requestId: "add-00002", nowMs: NOW, video: VIDEO_B });
    state = run(state, { type: "add-song", actor: cohost, requestId: "add-00003", nowMs: NOW, video: VIDEO_C });
    state = run(state, { type: "play-now", actor: host, requestId: "play-0003", expectedRevision: state.revision, nowMs: NOW, video: VIDEO_A });
    expect(state.queue.map((item) => item.videoId)).toEqual([VIDEO_B.videoId, VIDEO_C.videoId]);

    state = run(state, { type: "next", actor: host, requestId: "next0001", expectedRevision: state.revision, nowMs: NOW + 1000 });
    expect(state.currentVideoId).toBe(VIDEO_B.videoId);
    expect(state.queue.map((item) => item.videoId)).toEqual([VIDEO_C.videoId]);
    expect(state.history[0].videoId).toBe(VIDEO_A.videoId);
    expect(state.history[0].status).toBe("played");

    state = run(state, { type: "previous", actor: host, requestId: "prev0001", expectedRevision: state.revision, nowMs: NOW + 2000 });
    expect(state.currentVideoId).toBe(VIDEO_A.videoId);
    expect(state.queue[0].videoId).toBe(VIDEO_B.videoId);

    state = run(state, { type: "clear-queue", actor: host, requestId: "clear001", expectedRevision: state.revision, nowMs: NOW + 3000 });
    expect(state.queue).toHaveLength(0);
    expect(state.currentVideoId).toBe(VIDEO_A.videoId);
    expect(state.removed.length).toBeGreaterThan(0);

    const memberClear = applyCommand(state, { type: "clear-queue", actor: member, requestId: "clear002", expectedRevision: state.revision, nowMs: NOW + 4000 });
    expect(memberClear.ok).toBe(false);
  });

  it("rejects a second skip command that still carries the old revision", () => {
    let state = room();
    state = run(state, { type: "add-song", actor: host, requestId: "add-00004", nowMs: NOW, video: VIDEO_B });
    state = run(state, { type: "play-now", actor: host, requestId: "play-0004", expectedRevision: state.revision, nowMs: NOW, video: VIDEO_A });
    const revision = state.revision;
    const first = applyCommand(state, { type: "next", actor: host, requestId: "next0002", expectedRevision: revision, nowMs: NOW + 1000 });
    const second = applyCommand(first.state, { type: "next", actor: cohost, requestId: "next0003", expectedRevision: revision, nowMs: NOW + 1000 });
    expect(first.ok).toBe(true);
    expect(first.state.currentVideoId).toBe(VIDEO_B.videoId);
    expect(second.ok).toBe(false);
    expect(second.error?.code).toBe("stale_revision");
  });

  it("counts one skip vote per person and auto-skips only at the threshold", () => {
    let state = room();
    state = applyCommand(state, {
      type: "set-permissions",
      actor: host,
      requestId: "perm0001",
      expectedRevision: 0,
      nowMs: NOW,
      permissions: { autoSkipOnThreshold: true, skipThreshold: 2 },
    }).state;
    state = run(state, { type: "add-song", actor: member, requestId: "add-00005", nowMs: NOW, video: VIDEO_B });
    state = run(state, { type: "play-now", actor: host, requestId: "play-0005", expectedRevision: state.revision, nowMs: NOW, video: VIDEO_A });

    const first = applyCommand(state, { type: "skip-vote", actor: member, requestId: "vote0001", expectedRevision: state.revision, nowMs: NOW + 1000 });
    expect(first.ok).toBe(true);
    expect(first.state.currentVideoId).toBe(VIDEO_A.videoId);
    expect(first.state.skipVotes).toEqual([member.userId]);

    const again = applyCommand(first.state, { type: "skip-vote", actor: member, requestId: "vote0002", expectedRevision: first.state.revision, nowMs: NOW + 8000 });
    expect(again.error?.code).toBe("already_voted");

    const second = applyCommand(first.state, { type: "skip-vote", actor: cohost, requestId: "vote0003", expectedRevision: first.state.revision, nowMs: NOW + 9000 });
    expect(second.ok).toBe(true);
    expect(second.state.currentVideoId).toBe(VIDEO_B.videoId);
    expect(second.effect?.action).toBe("skip_auto");
  });

  it("moves the host when the current host leaves", () => {
    const members: MemberRef[] = [
      { userId: host.userId, role: "host", displayName: "Host", joinedAt: 1 },
      { userId: member.userId, role: "member", displayName: "Mem", joinedAt: 2 },
      { userId: cohost.userId, role: "cohost", displayName: "Co", joinedAt: 3 },
    ];
    expect(chooseNextHost(members, host.userId)?.userId).toBe(cohost.userId);
    const migrated = migrateHost(room(), host.userId, members, NOW + 5000);
    expect(migrated.nextHost?.userId).toBe(cohost.userId);
    expect(migrated.state.hostId).toBe(cohost.userId);
  });

  it("auto-advances when the server clock reaches the duration", () => {
    let state = room();
    state = run(state, { type: "add-song", actor: host, requestId: "add-00006", nowMs: NOW, video: VIDEO_B });
    state = run(state, { type: "play-now", actor: host, requestId: "play-0006", expectedRevision: state.revision, nowMs: NOW, video: VIDEO_A });
    const ticked = tickPlayback(state, NOW + 90_000, host);
    expect(ticked.changed).toBe(true);
    expect(ticked.state.currentVideoId).toBe(VIDEO_B.videoId);
  });

  it("rejects a client-supplied title that is not a real resolved video", () => {
    const state = room();
    const result = applyCommand(state, {
      type: "add-song",
      actor: host,
      requestId: "add-bad01",
      nowMs: NOW,
      video: { ...VIDEO_A, videoId: "bad", title: "" },
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("invalid_video");
  });

  it("rate-limits repeated adds", () => {
    let now = 0;
    const limiter = new RateLimiter(() => now);
    expect(limiter.allow("member:add", 2, 10_000)).toBe(true);
    expect(limiter.allow("member:add", 2, 10_000)).toBe(true);
    expect(limiter.allow("member:add", 2, 10_000)).toBe(false);
    now = 11_000;
    expect(limiter.allow("member:add", 2, 10_000)).toBe(true);
  });
});
