import { Injectable, NotFoundException } from "@nestjs/common";
import {
  DEFAULT_PERMISSIONS,
  errorMessage,
  hydratePlayback,
  type SongQueueItem,
  type TVPermissions,
  type TVState,
} from "@karaoke/shared";
import { PrismaService } from "../prisma/prisma.service";

export interface LoadedRoom {
  roomName: string;
  state: TVState;
}

@Injectable()
export class TvRepository {
  constructor(private readonly prisma: PrismaService) {}

  async load(roomId: string, nowMs = Date.now()): Promise<LoadedRoom> {
    const room = await this.prisma.karaokeRoom.findUnique({
      where: { id: roomId },
      include: { tvState: true, permissions: true, queue: true, skipVotes: true },
    });
    if (!room?.tvState || !room.permissions) {
      throw new NotFoundException({ code: "room_not_found", message: errorMessage("room_not_found") });
    }

    const permissions: TVPermissions = {
      memberCanAddSong: room.permissions.memberCanAddSong,
      memberCanVoteSkip: room.permissions.memberCanVoteSkip,
      memberCanControlPlayback: room.permissions.memberCanControlPlayback,
      coHostCanControlPlayback: room.permissions.coHostCanControlPlayback,
      hostOnlyCanClearQueue: room.permissions.hostOnlyCanClearQueue,
      skipThreshold: room.permissions.skipThreshold,
      autoSkipOnThreshold: room.permissions.autoSkipOnThreshold,
      voteCooldownMs: room.permissions.voteCooldownMs,
      voteDurationMs: room.permissions.voteDurationMs,
    };

    const toItem = (row: (typeof room.queue)[number]): SongQueueItem => ({
      id: row.id,
      videoId: row.videoId,
      title: row.title,
      thumbnail: row.thumbnail,
      channelTitle: row.channelTitle,
      requestedBy: row.requestedById,
      requestedByName: row.requestedByName,
      status: row.status as SongQueueItem["status"],
      position: row.position,
      createdAt: row.createdAt.getTime(),
      durationSec: null,
    });

    const waiting = room.queue
      .filter((row) => row.status === "waiting")
      .sort((a, b) => a.position - b.position)
      .map(toItem);
    const history = room.queue
      .filter((row) => row.status === "played")
      .sort((a, b) => a.position - b.position)
      .map(toItem);
    const removed = room.queue
      .filter((row) => row.status === "removed")
      .sort((a, b) => a.position - b.position)
      .map(toItem);

    const session = room.tvState.songSessionId;
    const votes = room.skipVotes
      .filter((vote) => vote.songSessionId === session)
      .map((vote) => vote.userId);

    const state: TVState = hydratePlayback(
      {
        roomId: room.id,
        currentVideoId: room.tvState.currentVideoId,
        currentSongTitle: room.tvState.currentSongTitle,
        currentThumbnail: room.tvState.currentThumbnail,
        currentChannelTitle: room.tvState.currentChannelTitle,
        currentSongId: room.tvState.currentSongId,
        currentRequestedBy: room.tvState.currentRequestedBy,
        currentRequestedByName: room.tvState.currentRequestedByName,
        playbackState: room.tvState.playbackState as TVState["playbackState"],
        anchorTime: room.tvState.currentTime,
        duration: room.tvState.duration,
        hostId: room.hostId,
        revision: room.tvState.revision,
        updatedAt: room.tvState.updatedAt.getTime(),
        songSessionId: room.tvState.songSessionId,
        queue: waiting,
        history,
        removed,
        permissions: { ...DEFAULT_PERMISSIONS, ...permissions },
        skipVotes: votes,
        skipVoteStartedAt: votes.length ? room.tvState.updatedAt.getTime() : null,
        skipRequested: votes.length >= permissions.skipThreshold && !permissions.autoSkipOnThreshold,
        errorCode: room.tvState.errorCode,
        errorMessage: room.tvState.errorMessage,
        voteCooldowns: {},
      },
      nowMs,
    );

    return { roomName: room.name, state };
  }

  async save(state: TVState) {
    const rows: SongQueueItem[] = [
      ...state.queue.map((item) => ({ ...item, status: "waiting" as const })),
      ...state.history.map((item) => ({ ...item, status: "played" as const })),
      ...state.removed.map((item) => ({ ...item, status: "removed" as const })),
    ];
    if (state.currentSongId && state.currentVideoId) {
      rows.unshift({
        id: state.currentSongId,
        videoId: state.currentVideoId,
        title: state.currentSongTitle ?? "YouTube",
        thumbnail: state.currentThumbnail ?? "",
        channelTitle: state.currentChannelTitle ?? "",
        requestedBy: state.currentRequestedBy || state.hostId,
        requestedByName: state.currentRequestedByName || "Host",
        status: "playing",
        position: 0,
        createdAt: state.updatedAt,
        durationSec: state.duration > 0 ? state.duration : null,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.roomTvState.update({
        where: { roomId: state.roomId },
        data: {
          currentVideoId: state.currentVideoId,
          currentSongTitle: state.currentSongTitle,
          currentThumbnail: state.currentThumbnail,
          currentChannelTitle: state.currentChannelTitle,
          currentSongId: state.currentSongId,
          currentRequestedBy: state.currentRequestedBy,
          currentRequestedByName: state.currentRequestedByName,
          playbackState: state.playbackState,
          currentTime: state.anchorTime,
          duration: state.duration,
          hostId: state.hostId,
          revision: state.revision,
          songSessionId: state.songSessionId,
          errorCode: state.errorCode,
          errorMessage: state.errorMessage,
          updatedAt: new Date(state.updatedAt),
        },
      });
      await tx.tvPermission.update({
        where: { roomId: state.roomId },
        data: {
          memberCanAddSong: state.permissions.memberCanAddSong,
          memberCanVoteSkip: state.permissions.memberCanVoteSkip,
          memberCanControlPlayback: state.permissions.memberCanControlPlayback,
          coHostCanControlPlayback: state.permissions.coHostCanControlPlayback,
          hostOnlyCanClearQueue: state.permissions.hostOnlyCanClearQueue,
          skipThreshold: state.permissions.skipThreshold,
          autoSkipOnThreshold: state.permissions.autoSkipOnThreshold,
          voteCooldownMs: state.permissions.voteCooldownMs,
          voteDurationMs: state.permissions.voteDurationMs,
        },
      });
      await tx.songQueue.deleteMany({ where: { roomId: state.roomId } });
      if (rows.length > 0) {
        await tx.songQueue.createMany({
          data: rows.map((item) => ({
            id: item.id,
            roomId: state.roomId,
            videoId: item.videoId,
            title: item.title || "YouTube",
            thumbnail: item.thumbnail || "",
            channelTitle: item.channelTitle || "",
            requestedById: item.requestedBy || state.hostId,
            requestedByName: item.requestedByName || "Người chơi",
            status: item.status,
            position: item.position,
            createdAt: new Date(item.createdAt || Date.now()),
          })),
        });
      }
    });
  }

  async recordVote(roomId: string, songSessionId: string, userId: string) {
    await this.prisma.skipVote.upsert({
      where: { roomId_songSessionId_userId: { roomId, songSessionId, userId } },
      update: {},
      create: { roomId, songSessionId, userId },
    });
  }

  async log(roomId: string, userId: string | null, action: string, detail: string) {
    await this.prisma.actionLog.create({
      data: { roomId, userId, action, detail: detail.slice(0, 500) },
    });
  }
}
