import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import {
  acceptRequest,
  applyCommand,
  errorMessage,
  expectedPlaybackTime,
  RateLimiter,
  type Actor,
  type ResolvedVideo,
  type TVState,
  type TvCommand,
} from "@karaoke/shared";

type ClientCommand = TvCommand extends infer Command ? Command extends TvCommand ? Omit<Command, "actor" | "nowMs"> : never : never;
import { roomBridge } from "../colyseus/room-bridge";
import { liveRooms } from "../colyseus/room-registry";
import { RoomsService } from "../rooms/rooms.service";
import { YoutubeService } from "../youtube/youtube.service";
import { TvRepository } from "./tv.repository";

@Injectable()
export class TvService implements OnModuleInit {
  private readonly requests = new Map<string, string[]>();
  private readonly limiter = new RateLimiter();

  constructor(
    private readonly repo: TvRepository,
    private readonly rooms: RoomsService,
    private readonly youtube: YoutubeService,
  ) {}

  onModuleInit() {
    roomBridge.load = (roomId) => this.repo.load(roomId);
    roomBridge.save = (state) => this.repo.save(state);
    roomBridge.log = (roomId, userId, action, detail) => this.repo.log(roomId, userId, action, detail);
    roomBridge.recordVote = (roomId, songSessionId, userId) => this.repo.recordVote(roomId, songSessionId, userId);
    roomBridge.resolveVideo = (input) => this.youtube.resolve(input);
    roomBridge.getMember = (roomId, userId) => this.rooms.getMember(roomId, userId);
    roomBridge.applyRoleChanges = (input) => this.rooms.applyRoleChanges(input);
    roomBridge.allow = (key, limit, windowMs) => this.limiter.allow(key, limit, windowMs);
  }

  async snapshot(roomId: string, userId: string) {
    await this.rooms.requireMember(roomId, userId);
    const live = liveRooms.get(roomId);
    if (live) return this.present(live.engine);
    const loaded = await this.repo.load(roomId);
    return this.present(loaded.state);
  }

  async queue(roomId: string, userId: string) {
    const snap = await this.snapshot(roomId, userId);
    return { current: snap.current, queue: snap.queue, history: snap.history };
  }

  async permissions(roomId: string, userId: string) {
    const snap = await this.snapshot(roomId, userId);
    return snap.permissions;
  }

  async search(roomId: string, userId: string, query: string) {
    await this.rooms.requireMember(roomId, userId);
    if (!this.limiter.allow(`${userId}:search`, 8, 60_000)) {
      throw new BadRequestException({ code: "rate_limited", message: errorMessage("rate_limited") });
    }
    return this.youtube.search(query);
  }

  async addSong(roomId: string, userId: string, input: { url?: string; videoId?: string; requestId: string; expectedRevision?: number }) {
    const video = await this.youtube.resolve(input.url || input.videoId || "");
    return this.mutate(roomId, userId, {
      type: "add-song",
      requestId: input.requestId,
      expectedRevision: input.expectedRevision,
      video,
    });
  }

  async playNow(roomId: string, userId: string, input: { url?: string; videoId?: string; songId?: string; requestId: string; expectedRevision?: number }) {
    let video: ResolvedVideo | undefined;
    if (!input.songId) video = await this.youtube.resolve(input.url || input.videoId || "");
    return this.mutate(roomId, userId, {
      type: "play-now",
      requestId: input.requestId,
      expectedRevision: input.expectedRevision,
      songId: input.songId,
      video,
    });
  }

  async next(roomId: string, userId: string, requestId: string, expectedRevision: number) {
    return this.mutate(roomId, userId, { type: "next", requestId, expectedRevision });
  }

  async remove(roomId: string, userId: string, songId: string, requestId: string, expectedRevision: number) {
    return this.mutate(roomId, userId, { type: "remove-song", requestId, expectedRevision, songId });
  }

  async clear(roomId: string, userId: string, requestId: string, expectedRevision: number) {
    return this.mutate(roomId, userId, { type: "clear-queue", requestId, expectedRevision });
  }

  async skipVote(roomId: string, userId: string, requestId: string, expectedRevision: number) {
    return this.mutate(roomId, userId, { type: "skip-vote", requestId, expectedRevision });
  }

  async updatePermissions(
    roomId: string,
    userId: string,
    body: {
      requestId: string;
      expectedRevision: number;
      memberCanAddSong?: boolean;
      memberCanVoteSkip?: boolean;
      memberCanControlPlayback?: boolean;
      coHostCanControlPlayback?: boolean;
      hostOnlyCanClearQueue?: boolean;
      autoSkipOnThreshold?: boolean;
      skipThreshold?: number;
      voteCooldownMs?: number;
      voteDurationMs?: number;
    },
  ) {
    const { requestId, expectedRevision, ...permissions } = body;
    return this.mutate(roomId, userId, { type: "set-permissions", requestId, expectedRevision, permissions });
  }

  private async mutate(roomId: string, userId: string, command: ClientCommand) {
    const member = await this.rooms.requireMember(roomId, userId);
    const actor: Actor = { userId, role: member.role as Actor["role"], displayName: member.user.displayName };
    const full = { ...command, actor, nowMs: Date.now() } as TvCommand;
    const live = liveRooms.get(roomId);
    if (live) {
      const result = await live.dispatch(full);
      if (!result.ok) throw new BadRequestException(result.error);
      return this.present(result.state);
    }
    if (!acceptRequest(this.requests, userId, command.requestId)) {
      throw new BadRequestException({ code: "duplicate_request", message: errorMessage("duplicate_request") });
    }
    const loaded = await this.repo.load(roomId);
    const result = applyCommand(loaded.state, full);
    if (!result.ok) throw new BadRequestException(result.error);
    await this.repo.save(result.state);
    if (result.effect?.vote && result.state.songSessionId) {
      await this.repo.recordVote(roomId, result.effect.vote.songSessionId, result.effect.vote.userId);
    }
    if (result.effect?.hostChange) {
      await this.rooms.applyRoleChanges({
        roomId,
        hostId: result.effect.hostChange.nextHostId,
        updates: [
          { userId: result.effect.hostChange.nextHostId, role: "host" },
          { userId: result.effect.hostChange.previousHostId, role: result.effect.hostChange.previousBecomes === "cohost" ? "cohost" : "member" },
        ],
      });
    }
    if (result.effect) await this.repo.log(roomId, result.effect.userId, result.effect.action, result.effect.detail);
    return this.present(result.state);
  }

  private present(state: TVState) {
    const serverNow = Date.now();
    return {
      roomId: state.roomId,
      currentVideoId: state.currentVideoId,
      currentSongTitle: state.currentSongTitle,
      currentThumbnail: state.currentThumbnail,
      currentChannelTitle: state.currentChannelTitle,
      currentSongId: state.currentSongId,
      requestedBy: state.currentRequestedBy,
      requestedByName: state.currentRequestedByName,
      playbackState: state.playbackState,
      anchorTime: state.anchorTime,
      currentTime: expectedPlaybackTime(state, serverNow),
      duration: state.duration,
      hostId: state.hostId,
      revision: state.revision,
      updatedAt: state.updatedAt,
      serverNow,
      songSessionId: state.songSessionId,
      queue: state.queue,
      history: state.history,
      removed: state.removed,
      skipVotes: state.skipVotes,
      skipRequested: state.skipRequested,
      permissions: state.permissions,
      errorCode: state.errorCode,
      errorMessage: state.errorMessage,
      current: state.currentVideoId
        ? {
            id: state.currentSongId,
            videoId: state.currentVideoId,
            title: state.currentSongTitle,
            thumbnail: state.currentThumbnail,
            requestedByName: state.currentRequestedByName,
            status: "playing",
          }
        : null,
    };
  }
}
