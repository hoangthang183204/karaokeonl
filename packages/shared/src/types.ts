export type RoomRole = "host" | "cohost" | "member";

export type PlaybackState =
  | "idle"
  | "playing"
  | "paused"
  | "buffering"
  | "ended"
  | "error";

export type SongStatus = "waiting" | "playing" | "played" | "removed";

export interface Actor {
  userId: string;
  role: RoomRole;
  displayName: string;
}

export interface MemberRef {
  userId: string;
  role: RoomRole;
  displayName: string;
  joinedAt: number;
}

export interface ResolvedVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  durationSec: number | null;
}

export interface SongQueueItem {
  id: string;
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  requestedBy: string;
  requestedByName: string;
  status: SongStatus;
  position: number;
  createdAt: number;
  durationSec: number | null;
}

export interface TVPermissions {
  memberCanAddSong: boolean;
  memberCanVoteSkip: boolean;
  memberCanControlPlayback: boolean;
  coHostCanControlPlayback: boolean;
  hostOnlyCanClearQueue: boolean;
  skipThreshold: number;
  autoSkipOnThreshold: boolean;
  voteCooldownMs: number;
  voteDurationMs: number;
}

export interface TVState {
  roomId: string;
  currentVideoId: string | null;
  currentSongTitle: string | null;
  currentThumbnail: string | null;
  currentChannelTitle: string | null;
  currentSongId: string | null;
  currentRequestedBy: string | null;
  currentRequestedByName: string | null;
  playbackState: PlaybackState;
  /** Vị trí phát (giây) tại thời điểm updatedAt. Không phải currentTime mỗi frame. */
  anchorTime: number;
  duration: number;
  hostId: string;
  revision: number;
  updatedAt: number;
  songSessionId: string | null;
  queue: SongQueueItem[];
  history: SongQueueItem[];
  removed: SongQueueItem[];
  permissions: TVPermissions;
  skipVotes: string[];
  skipVoteStartedAt: number | null;
  skipRequested: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  voteCooldowns: Record<string, number>;
}

export const DEFAULT_PERMISSIONS: TVPermissions = {
  memberCanAddSong: true,
  memberCanVoteSkip: true,
  memberCanControlPlayback: false,
  coHostCanControlPlayback: true,
  hostOnlyCanClearQueue: true,
  skipThreshold: 2,
  autoSkipOnThreshold: false,
  voteCooldownMs: 5000,
  voteDurationMs: 60000,
};

export const LIMITS = {
  maxQueue: 40,
  maxWaitingPerUser: 5,
  maxHistory: 20,
  maxRemoved: 20,
  maxTitle: 200,
  maxChannel: 120,
  maxName: 24,
  seekThresholdSec: 1.5,
  ignoreDriftSec: 0.45,
  maxVideoHours: 6,
};
