import { WEAPON_RACK, clampRoomPosition } from "./world";

export const COMBAT = {
  maxHp: 100,
  startHp: 100,
  injuredHp: 60,
  criticalHp: 20,
  recoverHp: 50,
  knockoutMs: 8000,
  recoverMs: 1400,
  reach: 1.75,
  stickDamage: 14,
  swingMs: 520,
  dodgeMs: 520,
  staggerMs: 520,
  swingCooldown: 780,
  dodgeCooldown: 820,
} as const;

export const COMBAT_ACTIONS = ["swing", "dodge"] as const;
export type CombatAction = (typeof COMBAT_ACTIONS)[number];
export type HpState = "normal" | "injured" | "critical" | "knocked_out" | "recovering";

export interface Fighter {
  id: string;
  x: number;
  z: number;
  y: number;
  rot: number;
  hp: number;
  hpState: string;
  motion: string;
  seated: boolean;
  seatId: string;
  combat: string;
  combatUntil: number;
  downUntil: number;
  recoverUntil: number;
  cooldownUntil: number;
  weapon: string;
}

export function hpStateFor(hp: number): Exclude<HpState, "recovering"> {
  if (hp <= 0) return "knocked_out";
  if (hp <= COMBAT.criticalHp) return "critical";
  if (hp <= COMBAT.injuredHp) return "injured";
  return "normal";
}

export function isCombatAction(value: string): value is CombatAction {
  return (COMBAT_ACTIONS as readonly string[]).includes(value);
}

export function combatLocked(fighter: Pick<Fighter, "hpState">): boolean {
  return fighter.hpState === "knocked_out" || fighter.hpState === "recovering";
}

export function takeStick(
  fighter: Fighter,
  stock: number,
  handsBusy: boolean,
): { ok: true; stock: number } | { ok: false; message: string } {
  if (combatLocked(fighter) || fighter.seated) return { ok: false, message: "Không lấy được gậy lúc này." };
  if (Math.hypot(fighter.x - WEAPON_RACK.x, fighter.z - WEAPON_RACK.z) > WEAPON_RACK.reach) {
    return { ok: false, message: "Hãy lại gần tủ gậy." };
  }
  if (fighter.weapon) return { ok: false, message: "Bạn đang cầm gậy." };
  if (handsBusy) return { ok: false, message: "Tay đang bận." };
  if (stock <= 0) return { ok: false, message: "Tủ gậy đã hết." };
  fighter.weapon = "stick";
  return { ok: true, stock: stock - 1 };
}

export function storeStick(
  fighter: Fighter,
  stock: number,
): { ok: true; stock: number } | { ok: false; message: string } {
  if (!fighter.weapon) return { ok: false, message: "Bạn không cầm gậy." };
  if (Math.hypot(fighter.x - WEAPON_RACK.x, fighter.z - WEAPON_RACK.z) > WEAPON_RACK.reach) {
    return { ok: false, message: "Hãy lại gần tủ gậy để cất." };
  }
  fighter.weapon = "";
  return { ok: true, stock: Math.min(WEAPON_RACK.stock, stock + 1) };
}

export function resolveCombat(
  attacker: Fighter,
  target: Fighter | null,
  action: CombatAction,
  now: number,
  pvpEnabled: boolean,
): { ok: true; returned: number } | { ok: false; message: string } {
  if (!pvpEnabled) return { ok: false, message: "Phòng đang tắt đối kháng." };
  if (combatLocked(attacker) || attacker.seated) return { ok: false, message: "Không thể ra đòn lúc này." };
  if (now < attacker.cooldownUntil) return { ok: false, message: "Đòn này chưa hồi." };
  if (action === "dodge") {
    beginSelf(attacker, "dodge", now);
    return { ok: true, returned: 0 };
  }
  if (attacker.weapon !== "stick") return { ok: false, message: "Hãy lấy gậy trong tủ trước." };
  if (!target || target.id === attacker.id) return { ok: false, message: "Hãy lại gần một người chơi khác." };
  if (combatLocked(target)) return { ok: false, message: "Người này đang nằm." };
  if (Math.hypot(attacker.x - target.x, attacker.z - target.z) > COMBAT.reach) {
    return { ok: false, message: "Hãy lại gần hơn." };
  }
  beginSelf(attacker, "swing", now);
  attacker.rot = Math.atan2(target.x - attacker.x, target.z - attacker.z);
  if (target.combat === "dodge" && now < target.combatUntil) return { ok: true, returned: 0 };
  if (target.seated) {
    target.seated = false;
    target.seatId = "";
  }
  const dx = target.x - attacker.x;
  const dz = target.z - attacker.z;
  const length = Math.hypot(dx, dz) || 1;
  const next = clampRoomPosition(target.x + (dx / length) * 0.35, target.z + (dz / length) * 0.35);
  target.x = next.x;
  target.z = next.z;
  return { ok: true, returned: applyHit(target, now) };
}

export function tickCombat(fighter: Fighter, now: number) {
  if (fighter.hpState === "knocked_out" && fighter.downUntil > 0 && now >= fighter.downUntil) {
    fighter.hp = COMBAT.recoverHp;
    fighter.hpState = "recovering";
    fighter.motion = "stand";
    fighter.combat = "recover";
    fighter.combatUntil = now + COMBAT.recoverMs;
    fighter.recoverUntil = now + COMBAT.recoverMs;
    fighter.downUntil = 0;
    fighter.y = 0;
    return;
  }
  if (fighter.hpState === "recovering" && now >= fighter.recoverUntil) {
    fighter.hpState = hpStateFor(fighter.hp);
    fighter.combat = "";
    fighter.combatUntil = 0;
    if (fighter.motion === "stand" || fighter.motion === "lie") fighter.motion = fighter.seated ? "sit" : "idle";
    return;
  }
  if (fighter.hpState === "knocked_out") return;
  if (fighter.combat && fighter.combat !== "recover" && fighter.combatUntil > 0 && now >= fighter.combatUntil) {
    fighter.combat = "";
    if (fighter.motion === "swing" || fighter.motion === "dodge" || fighter.motion === "stagger") {
      fighter.motion = fighter.seated ? "sit" : "idle";
    }
  }
}

function beginSelf(fighter: Fighter, action: CombatAction, now: number) {
  fighter.combat = action;
  fighter.motion = action;
  fighter.combatUntil = now + (action === "swing" ? COMBAT.swingMs : COMBAT.dodgeMs);
  fighter.cooldownUntil = now + (action === "swing" ? COMBAT.swingCooldown : COMBAT.dodgeCooldown);
}

function applyHit(target: Fighter, now: number): number {
  if (combatLocked(target)) return 0;
  target.hp = Math.max(0, target.hp - COMBAT.stickDamage);
  if (target.hp <= 0) {
    const returned = target.weapon ? 1 : 0;
    target.hp = 0;
    target.hpState = "knocked_out";
    target.motion = "lie";
    target.combat = "lie";
    target.weapon = "";
    target.y = 0;
    target.seated = false;
    target.seatId = "";
    target.downUntil = now + COMBAT.knockoutMs;
    target.combatUntil = target.downUntil;
    target.recoverUntil = 0;
    return returned;
  }
  target.hpState = hpStateFor(target.hp);
  target.motion = "stagger";
  target.combat = "stagger";
  target.combatUntil = now + COMBAT.staggerMs;
  return 0;
}
