import { describe, expect, it } from "vitest";
import { COMBAT, resolveCombat, storeStick, takeStick, tickCombat, type Fighter } from "./combat";
import { WEAPON_RACK } from "./world";

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
    weapon: "",
  };
}

describe("combat", () => {
  it("requires a stick from the rack before a swing lands", () => {
    const a = fighter("a", WEAPON_RACK.x, WEAPON_RACK.z + 1);
    const b = fighter("b", WEAPON_RACK.x + 1, WEAPON_RACK.z + 1);
    expect(resolveCombat(a, b, "swing", 1_000, true)).toEqual({ ok: false, message: "Hãy lấy gậy trong tủ trước." });
    const taken = takeStick(a, WEAPON_RACK.stock, false);
    expect(taken).toEqual({ ok: true, stock: 3 });
    expect(a.weapon).toBe("stick");
    expect(resolveCombat(a, b, "swing", 1_000, true).ok).toBe(true);
    expect(b.hp).toBe(86);
    expect(resolveCombat(a, b, "swing", 1_200, true)).toEqual({ ok: false, message: "Đòn này chưa hồi." });
    expect(b.hp).toBe(86);
  });

  it("misses when the target dodges", () => {
    const a = fighter("a");
    const b = fighter("b", 1, 0);
    a.weapon = "stick";
    b.weapon = "stick";
    resolveCombat(b, null, "dodge", 1_000, true);
    resolveCombat(a, b, "swing", 1_100, true);
    expect(b.hp).toBe(100);
    expect(b.weapon).toBe("stick");
  });

  it("returns the stick to the rack when a player is knocked out", () => {
    const a = fighter("a");
    const b = fighter("b", 1, 0);
    a.weapon = "stick";
    b.weapon = "stick";
    b.hp = 14;
    const hit = resolveCombat(a, b, "swing", 5_000, true);
    expect(hit).toEqual({ ok: true, returned: 1 });
    expect(b.weapon).toBe("");
    expect(b.hpState).toBe("knocked_out");
    tickCombat(b, 5_000 + COMBAT.knockoutMs);
    expect(b.hp).toBe(COMBAT.recoverHp);
    expect(resolveCombat(a, b, "swing", 5_000 + COMBAT.knockoutMs + 100, true).ok).toBe(false);
  });

  it("rejects a swing that is too far and an empty rack", () => {
    const a = fighter("a", WEAPON_RACK.x, WEAPON_RACK.z + 1);
    const b = fighter("b", 4, 0);
    a.weapon = "stick";
    expect(resolveCombat(a, b, "swing", 1_000, true).ok).toBe(false);
    expect(b.hp).toBe(100);
    expect(takeStick(fighter("c", WEAPON_RACK.x, WEAPON_RACK.z + 1), 0, false).ok).toBe(false);
    const held = fighter("d", WEAPON_RACK.x, WEAPON_RACK.z + 1);
    held.weapon = "stick";
    expect(storeStick(held, 3)).toEqual({ ok: true, stock: 4 });
  });
});
