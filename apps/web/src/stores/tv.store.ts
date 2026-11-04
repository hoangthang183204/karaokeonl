import { canPerform, type RoomRole, type SongQueueItem, type TvAction, type TVPermissions, DEFAULT_PERMISSIONS } from "@karaoke/shared";
import { create } from "zustand";
import type { Room } from "colyseus.js";

export interface RosterPlayer {
  id: string;
  name: string;
  role: RoomRole;
  seated: boolean;
  color: string;
}

export interface ChatLine {
  id: string;
  userId: string;
  name: string;
  text: string;
  at: number;
}

export interface RemoteTv {
  roomName: string;
  hostId: string;
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  requestedByName: string;
  songId: string;
  playbackState: string;
  anchorTime: number;
  duration: number;
  revision: number;
  updatedAt: number;
  songSessionId: string;
  errorMessage: string;
  skipRequested: boolean;
  canPrevious: boolean;
  permissions: TVPermissions;
  skipVoterIds: string[];
  skipThreshold: number;
  queue: SongQueueItem[];
  players: RosterPlayer[];
  chats: ChatLine[];
}

interface TvStore extends RemoteTv {
  connected: boolean;
  statusText: string;
  notice: string;
  autoplayBlocked: boolean;
  clockOffsetMs: number;
  myRole: RoomRole;
  send: (type: string, payload?: Record<string, unknown>) => void;
  room: Room | null;
  setRoom: (room: Room | null) => void;
  patch: (partial: Partial<TvStore>) => void;
}

const emptyPermissions = { ...DEFAULT_PERMISSIONS };

export const useTv = create<TvStore>((set, get) => ({
  roomName: "",
  hostId: "",
  videoId: "",
  title: "",
  thumbnail: "",
  channelTitle: "",
  requestedByName: "",
  songId: "",
  playbackState: "idle",
  anchorTime: 0,
  duration: 0,
  revision: 0,
  updatedAt: 0,
  songSessionId: "",
  errorMessage: "",
  skipRequested: false,
  canPrevious: false,
  permissions: emptyPermissions,
  skipVoterIds: [],
  skipThreshold: 2,
  queue: [],
  players: [],
  chats: [],
  connected: false,
  statusText: "Đang kết nối phòng...",
  notice: "",
  autoplayBlocked: false,
  clockOffsetMs: 0,
  myRole: "member",
  room: null,
  setRoom: (room) => set({ room }),
  patch: (partial) => set(partial),
  send: (type, payload = {}) => {
    const room = get().room;
    if (!room) {
      set({ notice: "Chưa kết nối realtime." });
      return;
    }
    room.send(type, payload);
  },
}));

export function myPermissions(userId: string | undefined): { role: RoomRole; can: (action: TvAction) => boolean } {
  const tv = useTv.getState();
  const role = tv.players.find((player) => player.id === userId)?.role ?? tv.myRole;
  return {
    role,
    can: (action) => canPerform({ userId: userId ?? "", role, displayName: "" }, action, tv.permissions, tv.hostId),
  };
}
