import type { MemberRef, TVState } from "./types";

export function chooseNextHost(members: MemberRef[], leavingUserId: string): MemberRef | null {
  const remaining = members.filter((member) => member.userId !== leavingUserId);
  if (remaining.length === 0) return null;
  const cohosts = remaining
    .filter((member) => member.role === "cohost")
    .sort((a, b) => a.joinedAt - b.joinedAt);
  if (cohosts.length > 0) return cohosts[0];
  const rest = [...remaining].sort((a, b) => a.joinedAt - b.joinedAt);
  return rest[0] ?? null;
}

export function applyHostMigration(state: TVState, leavingUserId: string, members: MemberRef[], nowMs: number): {
  state: TVState;
  nextHost: MemberRef | null;
} {
  if (state.hostId !== leavingUserId) {
    return { state, nextHost: null };
  }
  const nextHost = chooseNextHost(members, leavingUserId);
  if (!nextHost) {
    return {
      state: { ...state, hostId: "", revision: state.revision + 1, updatedAt: nowMs },
      nextHost: null,
    };
  }
  return {
    state: {
      ...state,
      hostId: nextHost.userId,
      revision: state.revision + 1,
      updatedAt: state.updatedAt,
    },
    nextHost,
  };
}
