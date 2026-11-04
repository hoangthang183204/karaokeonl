import { clampRoomPosition } from "./world";

export const COMBAT = {
  maxHp: 100,
  startHp: 100,
  injuredHp: 60,
  criticalHp: 20,
  recoverHp: 50,
  knockoutMs: 8000,
  recoverMs: 1400,
  reach: 1.45,
  tauntReach: 4,
  punchDamage: 12,
  pushDamage: 4,
  pushDistance: 0.7,
  punchMs: 480,
  pushMs: 420,
  dodgeMs: 520,
  blockMs: 760,
  tauntMs: 900,
  staggerMs: 520,
  punchCooldown: 720,
  pushCooldown: 900,
  dodgeCooldown: 820,
  blockCooldown: 400,
  tauntCooldown: 1500,
} as const;

export const COMBAT_ACTIONS = ["punch", "push", "dodge", "block", "taunt"] as const;
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

export function resolveCombat(
  attacker: Fighter,
  target: Fighter | null,
  action: CombatAction,
  now: number,
  pvpEnabled: boolean,
): { ok: true } | { ok: false; message: string } {
  if (!pvpEnabled) return { ok: false, message: "Phòng đang tắt đối kháng." };
  if (combatLocked(attacker) || attacker.seated) return { ok: false, message: "Không thể ra đòn lúc này." };
  if (now < attacker.cooldownUntil) return { ok: false, message: "Đòn này chưa hồi." };
  if (action === "dodge" || action === "block") {
    beginSelf(attacker, action, now);
    return { ok: true };
  }
  if (!target || target.id === attacker.id) return { ok: false, message: "Hãy lại gần một người chơi khác." };
  if (combatLocked(target)) return { ok: false, message: "Người này đang nằm." };
  const reach = action === "taunt" ? COMBAT.tauntReach : COMBAT.reach;
  if (Math.hypot(attacker.x - target.x, attacker.z - target.z) > reach) {
    return { ok: false, message: "Hãy lại gần hơn." };
  }
  beginSelf(attacker, action, now);
  face(attacker, target);
  if (action === "taunt") return { ok: true };
  if (target.combat === "dodge" && now < target.combatUntil) return { ok: true };
  if (target.combat === "block" && now < target.combatUntil) return { ok: true };
  if (target.seated) {
    target.seated = false;
    target.seatId = "";
  }
  if (action === "push") shove(attacker, target);
  const damage = action === "push" ? COMBAT.pushDamage : COMBAT.punchDamage;
  applyHit(target, damage, now);
  return { ok: true };
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
    if (isActionMotion(fighter.motion)) fighter.motion = fighter.seated ? "sit" : "idle";
  }
}

function beginSelf(fighter: Fighter, action: CombatAction, now: number) {
  const duration =
    action === "punch" ? COMBAT.punchMs
    : action === "push" ? COMBAT.pushMs
    : action === "dodge" ? COMBAT.dodgeMs
    : action === "block" ? COMBAT.blockMs
    : COMBAT.tauntMs;
  const cooldown =
    action === "punch" ? COMBAT.punchCooldown
    : action === "push" ? COMBAT.pushCooldown
    : action === "dodge" ? COMBAT.dodgeCooldown
    : action === "block" ? COMBAT.blockCooldown
    : COMBAT.tauntCooldown;
  fighter.combat = action;
  fighter.motion = action;
  fighter.combatUntil = now + duration;
  fighter.cooldownUntil = now + cooldown;
}

function applyHit(target: Fighter, damage: number, now: number) {
  if (combatLocked(target)) return;
  target.hp = Math.max(0, target.hp - damage);
  if (target.hp <= 0) {
    target.hp = 0;
    target.hpState = "knocked_out";
    target.motion = "lie";
    target.combat = "lie";
    target.y = 0;
    target.seated = false;
    target.seatId = "";
    target.downUntil = now + COMBAT.knockoutMs;
    target.combatUntil = target.downUntil;
    target.recoverUntil = 0;
    return;
  }
  target.hpState = hpStateFor(target.hp);
  target.motion = "stagger";
  target.combat = "stagger";
  target.combatUntil = now + COMBAT.staggerMs;
}

function shove(attacker: Fighter, target: Fighter) {
  const dx = target.x - attacker.x;
  const dz = target.z - attacker.z;
  const length = Math.hypot(dx, dz) || 1;
  const next = clampRoomPosition(
    target.x + (dx / length) * COMBAT.pushDistance,
    target.z + (dz / length) * COMBAT.pushDistance,
  );
  target.x = next.x;
  target.z = next.z;
}

function face(attacker: Fighter, target: Fighter) {
  attacker.rot = Math.atan2(target.x - attacker.x, target.z - attacker.z);
}

function isActionMotion(motion: string) {
  return motion === "punch" || motion === "push" || motion === "dodge" || motion === "block" || motion === "stagger" || motion === "taunt";
}
