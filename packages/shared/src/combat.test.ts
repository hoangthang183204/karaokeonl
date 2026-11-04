import { describe, expect, it } from "vitest";
import { COMBAT, resolveCombat, tickCombat, type Fighter } from "./combat";

function fighter(id: string, x = 0, z = 0): Fighter {
  return {
    id,
    x,
    z,
    y: 0,
    rot: 0,
    hp: COMBAT.startHp,
    hpState: "normal",
    motion: "idle",
    seated: false,
    seatId: "",
    combat: "",
    combatUntil: 0,
    downUntil: 0,
    recoverUntil: 0,
    cooldownUntil: 0,
  };
}

describe("combat", () => {
  it("applies one punch and rejects a second punch during cooldown", () => {
    const a = fighter("a");
    const b = fighter("b", 1, 0);
    expect(resolveCombat(a, b, "punch", 1_000, true).ok).toBe(true);
    expect(b.hp).toBe(88);
    expect(b.motion).toBe("stagger");
    expect(resolveCombat(a, b, "punch", 1_200, true)).toEqual({ ok: false, message: "Đòn này chưa hồi." });
    expect(b.hp).toBe(88);
  });

  it("misses a dodge and stops on a block", () => {
    const a = fighter("a");
    const b = fighter("b", 1, 0);
    resolveCombat(b, null, "dodge", 1_000, true);
    resolveCombat(a, b, "punch", 1_100, true);
    expect(b.hp).toBe(100);
    const c = fighter("c", 1, 0);
    resolveCombat(c, null, "block", 2_000, true);
    const d = fighter("d");
    resolveCombat(d, c, "punch", 2_100, true);
    expect(c.hp).toBe(100);
  });

  it("knocks a player down at zero and stands them up with configured HP", () => {
    const a = fighter("a");
    const b = fighter("b", 1, 0);
    b.hp = 12;
    resolveCombat(a, b, "punch", 5_000, true);
    expect(b.hpState).toBe("knocked_out");
    expect(b.motion).toBe("lie");
    expect(resolveCombat(b, a, "punch", 5_500, true).ok).toBe(false);
    tickCombat(b, 5_000 + COMBAT.knockoutMs - 1);
    expect(b.hpState).toBe("knocked_out");
    tickCombat(b, 5_000 + COMBAT.knockoutMs);
    expect(b.hpState).toBe("recovering");
    expect(b.hp).toBe(COMBAT.recoverHp);
    expect(resolveCombat(a, b, "punch", 5_000 + COMBAT.knockoutMs + 100, true).ok).toBe(false);
    expect(b.hp).toBe(COMBAT.recoverHp);
    tickCombat(b, 5_000 + COMBAT.knockoutMs + COMBAT.recoverMs);
    expect(b.hpState).toBe("injured");
    expect(b.motion).toBe("idle");
  });

  it("rejects a punch that is too far away", () => {
    const a = fighter("a");
    const b = fighter("b", 4, 0);
    expect(resolveCombat(a, b, "punch", 1_000, true).ok).toBe(false);
    expect(b.hp).toBe(100);
  });
});
