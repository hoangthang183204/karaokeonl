import { expectedPlaybackTime, shouldSeek } from "./playback";
import type { PlaybackState, TVState } from "./types";

export type LocalPlayerStatus =
  | "unready"
  | "unstarted"
  | "playing"
  | "paused"
  | "buffering"
  | "ended"
  | "cued";

export type SyncPlan =
  | { type: "none" }
  | { type: "wait-gesture" }
  | { type: "idle" }
  | { type: "error" }
  | { type: "load"; videoId: string; startSeconds: number; autoplay: boolean }
  | { type: "seek"; time: number }
  | { type: "play" }
  | { type: "pause" }
  | { type: "seek-and-play"; time: number }
  | { type: "seek-and-pause"; time: number };

export function planPlaybackSync(input: {
  remote: Pick<TVState, "currentVideoId" | "playbackState" | "anchorTime" | "updatedAt" | "duration" | "songSessionId">;
  localVideoId: string | null;
  localTime: number;
  localStatus: LocalPlayerStatus;
  autoplayBlocked: boolean;
  nowMs: number;
}): SyncPlan {
  const remoteState: PlaybackState = input.remote.playbackState;
  const videoId = input.remote.currentVideoId;

  if (!videoId || remoteState === "idle") return { type: "idle" };
  if (remoteState === "error") return { type: "error" };
  const expected = expectedPlaybackTime(input.remote, input.nowMs);
  const videoChanged = input.localVideoId !== videoId;
  if (input.localStatus === "unready" || videoChanged) {
    return {
      type: "load",
      videoId,
      startSeconds: expected,
      autoplay: remoteState === "playing",
    };
  }
  if (input.localStatus === "buffering") return { type: "none" };

  const waitingToStart = input.localStatus === "unstarted" || input.localStatus === "cued";
  if (waitingToStart) {
    if (remoteState !== "playing") return { type: "none" };
    return input.autoplayBlocked ? { type: "wait-gesture" } : { type: "play" };
  }

  if (input.autoplayBlocked && remoteState === "playing") {
    return { type: "wait-gesture" };
  }

  const drift = input.localTime - expected;
  const needsSeek = shouldSeek(drift);
  const wantPlay = remoteState === "playing";
  const wantPause = remoteState === "paused" || remoteState === "ended";
  const localPlaying = input.localStatus === "playing";

  if (wantPlay && !localPlaying && needsSeek) return { type: "seek-and-play", time: expected };
  if (wantPlay && !localPlaying) return { type: "play" };
  if (wantPause && localPlaying && needsSeek) return { type: "seek-and-pause", time: expected };
  if (wantPause && localPlaying) return { type: "pause" };
  if (needsSeek) return { type: "seek", time: expected };
  return { type: "none" };
}

export function estimateClockOffset(samples: number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}
