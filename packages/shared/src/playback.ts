import { LIMITS, type PlaybackState, type TVState } from "./types";

export function clampPlaybackTime(time: number, duration: number): number {
  if (!Number.isFinite(time)) return 0;
  const safe = Math.max(0, time);
  if (duration > 0) return Math.min(safe, duration);
  return safe;
}

export function expectedPlaybackTime(
  state: Pick<TVState, "playbackState" | "anchorTime" | "updatedAt" | "duration">,
  nowMs: number,
): number {
  if (state.playbackState !== "playing") {
    return clampPlaybackTime(state.anchorTime, state.duration);
  }
  const elapsedSec = Math.max(0, (nowMs - state.updatedAt) / 1000);
  return clampPlaybackTime(state.anchorTime + elapsedSec, state.duration);
}

export function isAuthoritativePlayback(state: PlaybackState): boolean {
  return state === "playing" || state === "paused" || state === "ended" || state === "idle" || state === "error";
}

export function playbackSignature(state: Pick<TVState, "currentVideoId" | "songSessionId" | "playbackState" | "anchorTime" | "updatedAt">): string {
  return [
    state.currentVideoId ?? "",
    state.songSessionId ?? "",
    state.playbackState,
    state.anchorTime.toFixed(3),
    state.updatedAt,
  ].join("|");
}

export function driftSeconds(localTime: number, expectedTime: number): number {
  if (!Number.isFinite(localTime) || !Number.isFinite(expectedTime)) return 0;
  return localTime - expectedTime;
}

export function shouldSeek(drift: number): boolean {
  return Math.abs(drift) >= LIMITS.seekThresholdSec;
}

export function shouldIgnoreDrift(drift: number): boolean {
  return Math.abs(drift) < LIMITS.ignoreDriftSec;
}
