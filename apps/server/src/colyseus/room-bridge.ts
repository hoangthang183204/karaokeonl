import type { ResolvedVideo, RoomRole, TVState } from "@karaoke/shared";
import type { LoadedRoom } from "../tv/tv.repository";

export interface MemberRecord {
  userId: string;
  role: string;
  joinedAt: Date;
  user: {
    displayName: string;
    gender?: string;
    skinColor?: string;
    hairColor?: string;
    outfitColor?: string;
    avatarModel?: string;
    outfit?: string;
    avatarCreated?: boolean;
  };
  room: { name: string; hostId: string };
}

export const roomBridge: {
  load?: (roomId: string) => Promise<LoadedRoom>;
  save?: (state: TVState) => Promise<void>;
  log?: (roomId: string, userId: string | null, action: string, detail: string) => Promise<void>;
  recordVote?: (roomId: string, songSessionId: string, userId: string) => Promise<void>;
  resolveVideo?: (input: string) => Promise<ResolvedVideo>;
  getMember?: (roomId: string, userId: string) => Promise<MemberRecord | null>;
  applyRoleChanges?: (input: {
    roomId: string;
    hostId?: string;
    updates?: { userId: string; role: RoomRole }[];
    removeUserId?: string;
  }) => Promise<void>;
  allow?: (key: string, limit: number, windowMs: number) => boolean;
} = {};
