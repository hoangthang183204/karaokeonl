import { errorMessage } from "./errors";
import { applyHostMigration } from "./host-migration";
import { canPerform } from "./permissions";
import { clampPlaybackTime, expectedPlaybackTime } from "./playback";
import { isStaleRevision } from "./revision";
import {
  DEFAULT_PERMISSIONS,
  LIMITS,
  type Actor,
  type MemberRef,
  type ResolvedVideo,
  type SongQueueItem,
  type TVPermissions,
  type TVState,
} from "./types";
import { cleanMetadataText, isAllowedThumbnailUrl, isValidYouTubeVideoId } from "./youtube-url";

export interface CommandEffect {
  action: string;
  detail: string;
  userId: string | null;
  vote?: { songSessionId: string; userId: string };
  hostChange?: { previousHostId: string; nextHostId: string; previousBecomes: "cohost" | "gone" };
  roleChange?: { userId: string; role: "cohost" | "member" };
}

export interface EngineResult {
  ok: boolean;
  state: TVState;
  error?: { code: string; message: string };
  effect?: CommandEffect;
}

type CommandBase = {
  actor: Actor;
  requestId: string;
  expectedRevision?: number;
  nowMs: number;
};

export type TvCommand =
  | (CommandBase & { type: "add-song"; video: ResolvedVideo })
  | (CommandBase & { type: "play-now"; video?: ResolvedVideo; songId?: string })
  | (CommandBase & { type: "pause" })
  | (CommandBase & { type: "resume" })
  | (CommandBase & { type: "seek"; time: number })
  | (CommandBase & { type: "next" })
  | (CommandBase & { type: "previous" })
  | (CommandBase & { type: "remove-song"; songId: string })
  | (CommandBase & { type: "clear-queue" })
  | (CommandBase & { type: "reorder"; songId: string; position: number })
  | (CommandBase & { type: "skip-vote" })
  | (CommandBase & { type: "set-permissions"; permissions: Partial<TVPermissions> })
  | (CommandBase & { type: "transfer-host"; targetUserId: string; members: MemberRef[] })
  | (CommandBase & { type: "set-role"; targetUserId: string; role: "cohost" | "member" })
  | (CommandBase & { type: "ended" })
  | (CommandBase & { type: "report-duration"; videoId: string; duration: number })
  | (CommandBase & { type: "report-error"; videoId: string; code: string; message: string });

function fail(state: TVState, code: string): EngineResult {
  return { ok: false, state, error: { code, message: errorMessage(code) } };
}

function ok(state: TVState, effect?: CommandEffect): EngineResult {
  return { ok: true, state, effect };
}

function bump(state: TVState, patch: Partial<TVState>, touchClock: boolean, nowMs: number): TVState {
  return {
    ...state,
    ...patch,
    revision: state.revision + 1,
    updatedAt: touchClock ? nowMs : state.updatedAt,
  };
}

function positioned(queue: SongQueueItem[]): SongQueueItem[] {
  return queue.map((item, index) => ({ ...item, position: index }));
}

function makeId(): string {
  return crypto.randomUUID();
}

function normalizeVideo(video: ResolvedVideo): ResolvedVideo | null {
  if (!isValidYouTubeVideoId(video.videoId)) return null;
  const title = cleanMetadataText(video.title, LIMITS.maxTitle);
  if (!title) return null;
  if (!isAllowedThumbnailUrl(video.thumbnail)) return null;
  const duration = video.durationSec;
  if (duration !== null && (!Number.isFinite(duration) || duration <= 0 || duration > LIMITS.maxVideoHours * 3600)) {
    return null;
  }
  return {
    videoId: video.videoId,
    title,
    thumbnail: video.thumbnail,
    channelTitle: cleanMetadataText(video.channelTitle ?? "", LIMITS.maxChannel),
    durationSec: duration,
  };
}

function songFromVideo(video: ResolvedVideo, actor: Actor, status: SongQueueItem["status"], nowMs: number): SongQueueItem {
  return {
    id: makeId(),
    videoId: video.videoId,
    title: video.title,
    thumbnail: video.thumbnail,
    channelTitle: video.channelTitle,
    requestedBy: actor.userId,
    requestedByName: actor.displayName,
    status,
    position: 0,
    createdAt: nowMs,
    durationSec: video.durationSec,
  };
}

function rememberPlayed(state: TVState, item: SongQueueItem | null): SongQueueItem[] {
  if (!item) return state.history;
  const played: SongQueueItem = { ...item, status: "played", position: 0 };
  return [played, ...state.history.filter((entry) => entry.id !== item.id)].slice(0, LIMITS.maxHistory);
}

function currentItem(state: TVState): SongQueueItem | null {
  if (!state.currentVideoId || !state.currentSongId) return null;
  return {
    id: state.currentSongId,
    videoId: state.currentVideoId,
    title: state.currentSongTitle ?? "",
    thumbnail: state.currentThumbnail ?? "",
    channelTitle: state.currentChannelTitle ?? "",
    requestedBy: state.currentRequestedBy ?? "",
    requestedByName: state.currentRequestedByName ?? "",
    status: "playing",
    position: 0,
    createdAt: state.updatedAt,
    durationSec: state.duration > 0 ? state.duration : null,
  };
}

function videoInUse(state: TVState, videoId: string): boolean {
  if (state.currentVideoId === videoId && state.playbackState !== "idle" && state.playbackState !== "ended") {
    return true;
  }
  return state.queue.some((item) => item.videoId === videoId && item.status === "waiting");
}

function startVideo(state: TVState, item: SongQueueItem, nowMs: number, duration: number | null): TVState {
  return bump(
    state,
    {
      currentVideoId: item.videoId,
      currentSongTitle: item.title,
      currentThumbnail: item.thumbnail,
      currentChannelTitle: item.channelTitle,
      currentSongId: item.id,
      currentRequestedBy: item.requestedBy,
      currentRequestedByName: item.requestedByName,
      playbackState: "playing",
      anchorTime: 0,
      duration: duration && duration > 0 ? duration : state.currentVideoId === item.videoId ? state.duration : 0,
      songSessionId: makeId(),
      skipVotes: [],
      skipVoteStartedAt: null,
      skipRequested: false,
      errorCode: null,
      errorMessage: null,
      queue: positioned(state.queue.filter((entry) => entry.id !== item.id)),
    },
    true,
    nowMs,
  );
}

function goIdle(state: TVState, nowMs: number): TVState {
  return bump(
    state,
    {
      currentVideoId: null,
      currentSongTitle: null,
      currentThumbnail: null,
      currentChannelTitle: null,
      currentSongId: null,
      currentRequestedBy: null,
      currentRequestedByName: null,
      playbackState: "idle",
      anchorTime: 0,
      duration: 0,
      songSessionId: null,
      skipVotes: [],
      skipVoteStartedAt: null,
      skipRequested: false,
      errorCode: null,
      errorMessage: null,
    },
    true,
    nowMs,
  );
}

function advance(state: TVState, actor: Actor, nowMs: number): EngineResult {
  const previous = currentItem(state);
  const history = rememberPlayed(state, previous);
  const [next, ...rest] = state.queue;
  if (!next) {
    return ok(
      { ...goIdle(state, nowMs), history },
      { action: "next", detail: "queue-empty", userId: actor.userId },
    );
  }
  const playing: SongQueueItem = { ...next, status: "playing" };
  const started = startVideo({ ...state, history, queue: rest }, playing, nowMs, null);
  return ok(started, { action: "next", detail: next.videoId, userId: actor.userId });
}

function requireControl(state: TVState, actor: Actor): EngineResult | null {
  if (!canPerform(actor, "control", state.permissions, state.hostId)) {
    return fail(state, "forbidden");
  }
  return null;
}

function requireRevision(state: TVState, expected: number | undefined, required: boolean): EngineResult | null {
  if (isStaleRevision(expected, state.revision, required)) return fail(state, "stale_revision");
  return null;
}

function freezeIfStale(state: TVState, nowMs: number): TVState {
  if (state.playbackState !== "playing") return state;
  if (nowMs - state.updatedAt < 20000) return state;
  const anchorTime = expectedPlaybackTime(state, nowMs);
  return {
    ...state,
    playbackState: "paused",
    anchorTime,
    updatedAt: nowMs,
    revision: state.revision + 1,
  };
}

export function createRoomState(input: {
  roomId: string;
  hostId: string;
  permissions?: Partial<TVPermissions>;
  nowMs?: number;
}): TVState {
  return {
    roomId: input.roomId,
    currentVideoId: null,
    currentSongTitle: null,
    currentThumbnail: null,
    currentChannelTitle: null,
    currentSongId: null,
    currentRequestedBy: null,
    currentRequestedByName: null,
    playbackState: "idle",
    anchorTime: 0,
    duration: 0,
    hostId: input.hostId,
    revision: 0,
    updatedAt: input.nowMs ?? Date.now(),
    songSessionId: null,
    queue: [],
    history: [],
    removed: [],
    permissions: { ...DEFAULT_PERMISSIONS, ...input.permissions },
    skipVotes: [],
    skipVoteStartedAt: null,
    skipRequested: false,
    errorCode: null,
    errorMessage: null,
    voteCooldowns: {},
  };
}

export function hydratePlayback(state: TVState, nowMs: number): TVState {
  return freezeIfStale(state, nowMs);
}

function sanitizePermissions(patch: Partial<TVPermissions>, current: TVPermissions): TVPermissions | null {
  const next: TVPermissions = { ...current };
  const boolKeys = [
    "memberCanAddSong",
    "memberCanVoteSkip",
    "memberCanControlPlayback",
    "coHostCanControlPlayback",
    "hostOnlyCanClearQueue",
    "autoSkipOnThreshold",
  ] as const;
  for (const key of boolKeys) {
    if (patch[key] !== undefined) {
      if (typeof patch[key] !== "boolean") return null;
      next[key] = patch[key];
    }
  }
  if (patch.skipThreshold !== undefined) {
    if (!Number.isInteger(patch.skipThreshold) || patch.skipThreshold < 1 || patch.skipThreshold > 50) return null;
    next.skipThreshold = patch.skipThreshold;
  }
  if (patch.voteCooldownMs !== undefined) {
    if (!Number.isInteger(patch.voteCooldownMs) || patch.voteCooldownMs < 0 || patch.voteCooldownMs > 300000) return null;
    next.voteCooldownMs = patch.voteCooldownMs;
  }
  if (patch.voteDurationMs !== undefined) {
    if (!Number.isInteger(patch.voteDurationMs) || patch.voteDurationMs < 5000 || patch.voteDurationMs > 300000) return null;
    next.voteDurationMs = patch.voteDurationMs;
  }
  return next;
}

function refreshSkipRequest(state: TVState): TVState {
  const reached = state.skipVotes.length >= state.permissions.skipThreshold;
  return { ...state, skipRequested: reached && !state.permissions.autoSkipOnThreshold };
}

export function expireSkipVotes(state: TVState, nowMs: number): TVState {
  if (!state.skipVoteStartedAt || state.skipVotes.length === 0) return state;
  if (nowMs - state.skipVoteStartedAt < state.permissions.voteDurationMs) return state;
  return bump(
    state,
    { skipVotes: [], skipVoteStartedAt: null, skipRequested: false },
    false,
    nowMs,
  );
}

export function applyCommand(state: TVState, command: TvCommand): EngineResult {
  const revisionError = requireRevision(state, command.expectedRevision, command.type !== "add-song" && command.type !== "report-duration");
  if (revisionError && command.type !== "add-song" && command.type !== "report-duration") return revisionError;

  switch (command.type) {
    case "add-song": {
      if (!canPerform(command.actor, "addSong", state.permissions, state.hostId)) return fail(state, "forbidden");
      const video = normalizeVideo(command.video);
      if (!video) return fail(state, "invalid_video");
      if (state.queue.length >= LIMITS.maxQueue) return fail(state, "queue_full");
      const mine = state.queue.filter((item) => item.requestedBy === command.actor.userId).length;
      if (mine >= LIMITS.maxWaitingPerUser) return fail(state, "user_queue_full");
      if (videoInUse(state, video.videoId)) return fail(state, "duplicate_video");
      const item = songFromVideo(video, command.actor, "waiting", command.nowMs);
      return ok(
        bump(state, { queue: positioned([...state.queue, item]) }, false, command.nowMs),
        { action: "add_song", detail: video.videoId, userId: command.actor.userId },
      );
    }
    case "play-now": {
      const denied = requireControl(state, command.actor);
      if (denied) return denied;
      let item: SongQueueItem | null = null;
      let duration: number | null = null;
      if (command.songId) {
        const queued = state.queue.find((entry) => entry.id === command.songId);
        if (!queued) return fail(state, "song_not_found");
        item = { ...queued, status: "playing" };
      } else if (command.video) {
        const video = normalizeVideo(command.video);
        if (!video) return fail(state, "invalid_video");
        const existing = state.queue.find((entry) => entry.videoId === video.videoId);
        item = existing
          ? { ...existing, status: "playing", title: video.title, thumbnail: video.thumbnail, channelTitle: video.channelTitle }
          : songFromVideo(video, command.actor, "playing", command.nowMs);
        duration = video.durationSec;
      } else {
        return fail(state, "invalid_video");
      }
      const history = rememberPlayed(state, currentItem(state));
      const started = startVideo({ ...state, history }, item, command.nowMs, duration);
      return ok(started, { action: "play_now", detail: item.videoId, userId: command.actor.userId });
    }
    case "pause": {
      const denied = requireControl(state, command.actor);
      if (denied) return denied;
      if (!state.currentVideoId || (state.playbackState !== "playing" && state.playbackState !== "buffering")) {
        return fail(state, "nothing_playing");
      }
      const anchorTime = expectedPlaybackTime(state, command.nowMs);
      return ok(
        bump(state, { playbackState: "paused", anchorTime }, true, command.nowMs),
        { action: "pause", detail: String(anchorTime), userId: command.actor.userId },
      );
    }
    case "resume": {
      const denied = requireControl(state, command.actor);
      if (denied) return denied;
      if (!state.currentVideoId || (state.playbackState !== "paused" && state.playbackState !== "ended")) {
        return fail(state, "nothing_playing");
      }
      return ok(
        bump(state, { playbackState: "playing", errorCode: null, errorMessage: null }, true, command.nowMs),
        { action: "resume", detail: state.currentVideoId, userId: command.actor.userId },
      );
    }
    case "seek": {
      const denied = requireControl(state, command.actor);
      if (denied) return denied;
      if (!state.currentVideoId || state.playbackState === "idle") return fail(state, "nothing_playing");
      if (!Number.isFinite(command.time) || command.time < 0) return fail(state, "bad_seek");
      const anchorTime = clampPlaybackTime(command.time, state.duration);
      return ok(
        bump(state, { anchorTime }, true, command.nowMs),
        { action: "seek", detail: String(anchorTime), userId: command.actor.userId },
      );
    }
    case "next": {
      const denied = requireControl(state, command.actor);
      if (denied) return denied;
      if (!state.currentVideoId && state.queue.length === 0) return fail(state, "empty_queue");
      return advance(state, command.actor, command.nowMs);
    }
    case "previous": {
      const denied = requireControl(state, command.actor);
      if (denied) return denied;
      const [previous, ...older] = state.history;
      if (!previous) return fail(state, "no_previous");
      const current = currentItem(state);
      const queue = current
        ? positioned([{ ...current, status: "waiting" }, ...state.queue.filter((item) => item.id !== current.id)])
        : state.queue;
      const playing: SongQueueItem = { ...previous, status: "playing" };
      const started = startVideo({ ...state, history: older, queue }, playing, command.nowMs, null);
      return ok(started, { action: "previous", detail: previous.videoId, userId: command.actor.userId });
    }
    case "remove-song": {
      if (!canPerform(command.actor, "removeSong", state.permissions, state.hostId)) return fail(state, "forbidden");
      const index = state.queue.findIndex((item) => item.id === command.songId);
      if (index < 0) return fail(state, "song_not_found");
      const [removedItem] = state.queue.slice(index, index + 1);
      const queue = positioned(state.queue.filter((item) => item.id !== command.songId));
      const removed = [{ ...removedItem, status: "removed" as const }, ...state.removed].slice(0, LIMITS.maxRemoved);
      return ok(
        bump(state, { queue, removed }, false, command.nowMs),
        { action: "remove_song", detail: removedItem.videoId, userId: command.actor.userId },
      );
    }
    case "clear-queue": {
      if (!canPerform(command.actor, "clearQueue", state.permissions, state.hostId)) return fail(state, "forbidden");
      const removed = [
        ...state.queue.map((item) => ({ ...item, status: "removed" as const })),
        ...state.removed,
      ].slice(0, LIMITS.maxRemoved);
      return ok(
        bump(state, { queue: [], removed }, false, command.nowMs),
        { action: "clear_queue", detail: String(state.queue.length), userId: command.actor.userId },
      );
    }
    case "reorder": {
      if (!canPerform(command.actor, "reorder", state.permissions, state.hostId)) return fail(state, "forbidden");
      const currentIndex = state.queue.findIndex((item) => item.id === command.songId);
      if (currentIndex < 0) return fail(state, "song_not_found");
      if (!Number.isInteger(command.position)) return fail(state, "invalid_request");
      const nextQueue = [...state.queue];
      const [item] = nextQueue.splice(currentIndex, 1);
      const target = Math.max(0, Math.min(command.position, nextQueue.length));
      nextQueue.splice(target, 0, item);
      return ok(
        bump(state, { queue: positioned(nextQueue) }, false, command.nowMs),
        { action: "reorder", detail: command.songId, userId: command.actor.userId },
      );
    }
    case "skip-vote": {
      if (!canPerform(command.actor, "voteSkip", state.permissions, state.hostId)) {
        return fail(state, command.actor.role === "host" ? "host_can_skip" : "vote_disabled");
      }
      if (!state.songSessionId || !state.currentVideoId) return fail(state, "nothing_playing");
      if (state.skipVotes.includes(command.actor.userId)) return fail(state, "already_voted");
      const last = state.voteCooldowns[command.actor.userId] ?? 0;
      if (command.nowMs - last < state.permissions.voteCooldownMs) return fail(state, "vote_cooldown");
      const skipVotes = [...state.skipVotes, command.actor.userId];
      let next = refreshSkipRequest({
        ...state,
        skipVotes,
        skipVoteStartedAt: state.skipVoteStartedAt ?? command.nowMs,
        voteCooldowns: { ...state.voteCooldowns, [command.actor.userId]: command.nowMs },
      });
      next = bump(next, {}, false, command.nowMs);
      const effect: CommandEffect = {
        action: "skip_vote",
        detail: `${skipVotes.length}/${state.permissions.skipThreshold}`,
        userId: command.actor.userId,
        vote: { songSessionId: state.songSessionId, userId: command.actor.userId },
      };
      if (skipVotes.length >= state.permissions.skipThreshold && state.permissions.autoSkipOnThreshold) {
        const advanced = advance(next, command.actor, command.nowMs);
        if (!advanced.ok) return advanced;
        return ok(advanced.state, {
          action: "skip_auto",
          detail: state.currentVideoId ?? "",
          userId: command.actor.userId,
          vote: effect.vote,
        });
      }
      return ok(next, effect);
    }
    case "set-permissions": {
      if (!canPerform(command.actor, "setPermissions", state.permissions, state.hostId)) return fail(state, "forbidden");
      const permissions = sanitizePermissions(command.permissions, state.permissions);
      if (!permissions) return fail(state, "invalid_request");
      return ok(
        refreshSkipRequest(bump(state, { permissions }, false, command.nowMs)),
        { action: "permissions", detail: "updated", userId: command.actor.userId },
      );
    }
    case "transfer-host": {
      if (!canPerform(command.actor, "transferHost", state.permissions, state.hostId)) return fail(state, "forbidden");
      const target = command.members.find((member) => member.userId === command.targetUserId);
      if (!target || target.userId === command.actor.userId) return fail(state, "target_not_found");
      return ok(
        bump(state, { hostId: target.userId }, false, command.nowMs),
        {
          action: "transfer_host",
          detail: target.userId,
          userId: command.actor.userId,
          hostChange: { previousHostId: command.actor.userId, nextHostId: target.userId, previousBecomes: "cohost" },
        },
      );
    }
    case "set-role": {
      if (!canPerform(command.actor, "setRole", state.permissions, state.hostId)) return fail(state, "forbidden");
      if (command.targetUserId === state.hostId || command.targetUserId === command.actor.userId) {
        return fail(state, "invalid_role");
      }
      if (command.role !== "cohost" && command.role !== "member") return fail(state, "invalid_role");
      return ok(bump(state, {}, false, command.nowMs), {
        action: "set_role",
        detail: `${command.targetUserId}:${command.role}`,
        userId: command.actor.userId,
        roleChange: { userId: command.targetUserId, role: command.role },
      });
    }
    case "ended": {
      if (!state.currentVideoId || state.playbackState !== "playing") return fail(state, "not_ended");
      const serverTime = expectedPlaybackTime(state, command.nowMs);
      const nearEnd = state.duration > 0 && serverTime >= state.duration - 2;
      const hostEnded = command.actor.userId === state.hostId || command.actor.role === "host";
      if (!nearEnd && !hostEnded) return fail(state, "not_ended");
      return advance(state, command.actor, command.nowMs);
    }
    case "report-duration": {
      if (!isValidYouTubeVideoId(command.videoId) || command.videoId !== state.currentVideoId) {
        return fail(state, "invalid_video");
      }
      if (!Number.isFinite(command.duration) || command.duration <= 0 || command.duration > LIMITS.maxVideoHours * 3600) {
        return fail(state, "invalid_request");
      }
      if (Math.abs(state.duration - command.duration) < 0.5) return ok(state);
      return ok({ ...state, duration: command.duration });
    }
    case "report-error": {
      const trusted = command.actor.userId === state.hostId || command.actor.role === "host" || command.actor.role === "cohost";
      if (!trusted) return fail(state, "forbidden");
      if (command.videoId !== state.currentVideoId) return fail(state, "invalid_video");
      return ok(
        bump(
          state,
          {
            playbackState: "error",
            errorCode: command.code.slice(0, 40),
            errorMessage: command.message.slice(0, 240),
            anchorTime: expectedPlaybackTime(state, command.nowMs),
          },
          true,
          command.nowMs,
        ),
        { action: "player_error", detail: command.code, userId: command.actor.userId },
      );
    }
    default:
      return fail(state, "invalid_request");
  }
}

export function tickPlayback(state: TVState, nowMs: number, host: Actor): { state: TVState; changed: boolean; effect?: CommandEffect } {
  const expired = expireSkipVotes(state, nowMs);
  if (expired.playbackState === "playing" && expired.duration > 0) {
    const time = expectedPlaybackTime(expired, nowMs);
    if (time >= expired.duration - 0.25) {
      const ended = applyCommand(expired, {
        type: "ended",
        actor: host,
        requestId: `tick-${expired.songSessionId}-${Math.floor(nowMs / 1000)}`,
        expectedRevision: expired.revision,
        nowMs,
      });
      if (ended.ok) return { state: ended.state, changed: true, effect: ended.effect };
    }
  }
  return { state: expired, changed: expired !== state };
}

export function migrateHost(state: TVState, leavingUserId: string, members: MemberRef[], nowMs: number) {
  return applyHostMigration(state, leavingUserId, members, nowMs);
}

export function playbackAnchor(state: TVState, nowMs: number): number {
  return expectedPlaybackTime(state, nowMs);
}
