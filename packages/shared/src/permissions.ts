import type { Actor, RoomRole, TVPermissions } from "./types";

export type TvAction =
  | "search"
  | "addSong"
  | "control"
  | "lights"
  | "removeSong"
  | "clearQueue"
  | "reorder"
  | "voteSkip"
  | "setPermissions"
  | "transferHost"
  | "setRole";

export function isHost(actor: Actor, hostId: string): boolean {
  return actor.userId === hostId;
}

export function canPerform(actor: Actor, action: TvAction, permissions: TVPermissions, hostId: string): boolean {
  const host = isHost(actor, hostId);

  switch (action) {
    case "search":
    case "addSong":
    case "control":
    case "removeSong":
    case "reorder":
      return actor.role === "host" || actor.role === "cohost" || actor.role === "member";
    case "lights":
      if (host) return true;
      if (actor.role === "cohost") return permissions.coHostCanControlPlayback;
      if (actor.role === "member") return permissions.memberCanControlPlayback;
      return false;
    case "clearQueue":
      if (host) return true;
      if (permissions.hostOnlyCanClearQueue) return false;
      return actor.role === "cohost";
    case "voteSkip":
      if (host) return false;
      if (actor.role === "cohost") return true;
      return permissions.memberCanVoteSkip;
    case "setPermissions":
    case "transferHost":
    case "setRole":
      return host;
    default:
      return false;
  }
}

export function canAssignRole(actor: Actor, hostId: string, targetUserId: string, nextRole: RoomRole): boolean {
  if (!isHost(actor, hostId)) return false;
  if (actor.userId === targetUserId) return false;
  if (nextRole === "host") return false;
  return nextRole === "cohost" || nextRole === "member";
}
