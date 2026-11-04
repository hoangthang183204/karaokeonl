import { describe, expect, it } from "vitest";
import { canAssignRole, canPerform } from "./permissions";
import { DEFAULT_PERMISSIONS, type Actor, type TVPermissions } from "./types";

const host: Actor = { userId: "h", role: "host", displayName: "Host" };
const cohost: Actor = { userId: "c", role: "cohost", displayName: "Co" };
const member: Actor = { userId: "m", role: "member", displayName: "Mem" };

function matrix(perms: TVPermissions = DEFAULT_PERMISSIONS) {
  return {
    hostSearch: canPerform(host, "search", perms, host.userId),
    memberAdd: canPerform(member, "addSong", perms, host.userId),
    memberControl: canPerform(member, "control", perms, host.userId),
    cohostControl: canPerform(cohost, "control", perms, host.userId),
    memberClear: canPerform(member, "clearQueue", perms, host.userId),
    cohostClear: canPerform(cohost, "clearQueue", perms, host.userId),
    hostClear: canPerform(host, "clearQueue", perms, host.userId),
    memberVote: canPerform(member, "voteSkip", perms, host.userId),
    hostVote: canPerform(host, "voteSkip", perms, host.userId),
    memberPerms: canPerform(member, "setPermissions", perms, host.userId),
    hostPerms: canPerform(host, "setPermissions", perms, host.userId),
  };
}

describe("permission matrix", () => {
  it("matches the default karaoke room policy", () => {
    expect(matrix()).toEqual({
      hostSearch: true,
      memberAdd: true,
      memberControl: false,
      cohostControl: true,
      memberClear: false,
      cohostClear: false,
      hostClear: true,
      memberVote: true,
      hostVote: false,
      memberPerms: false,
      hostPerms: true,
    });
  });

  it("lets the host open member playback and co-host queue clearing", () => {
    const perms: TVPermissions = {
      ...DEFAULT_PERMISSIONS,
      memberCanControlPlayback: true,
      memberCanAddSong: false,
      memberCanVoteSkip: false,
      coHostCanControlPlayback: false,
      hostOnlyCanClearQueue: false,
    };
    expect(canPerform(member, "control", perms, host.userId)).toBe(true);
    expect(canPerform(member, "addSong", perms, host.userId)).toBe(false);
    expect(canPerform(member, "voteSkip", perms, host.userId)).toBe(false);
    expect(canPerform(cohost, "control", perms, host.userId)).toBe(false);
    expect(canPerform(cohost, "clearQueue", perms, host.userId)).toBe(true);
  });

  it("only the host can assign co-host or member roles", () => {
    expect(canAssignRole(host, host.userId, member.userId, "cohost")).toBe(true);
    expect(canAssignRole(host, host.userId, member.userId, "host")).toBe(false);
    expect(canAssignRole(host, host.userId, host.userId, "member")).toBe(false);
    expect(canAssignRole(member, host.userId, cohost.userId, "member")).toBe(false);
  });
});
