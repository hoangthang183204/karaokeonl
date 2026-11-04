import { DRINK } from "./service-config";
import { nextCanSlot, type ServiceWorld } from "./npc";

export interface HandState {
  hand: string;
  handUntil: number;
  drunkLevel: number;
  cansDrunk: number;
}

export function emptyHand(): HandState {
  return { hand: "", handUntil: 0, drunkLevel: 0, cansDrunk: 0 };
}

export function takeCan(
  world: ServiceWorld,
  actor: { id: string; x: number; z: number; role: string },
  hand: HandState,
  now: number,
): { ok: true } | { ok: false; message: string } {
  if (hand.hand) return { ok: false, message: "Tay đang cầm lon." };
  const crate = nearestCrate(world, actor.x, actor.z);
  if (!crate) return { ok: false, message: "Hãy lại gần thùng bia." };
  if (crate.ownerId !== actor.id && actor.role !== "host" && actor.role !== "cohost") {
    return { ok: false, message: "Thùng bia này của người gọi." };
  }
  if (crate.remaining <= 0 || crate.status === "empty") return { ok: false, message: "Thùng bia đã hết." };
  crate.remaining -= 1;
  crate.status = crate.remaining === 0 ? "empty" : "opened";
  hand.hand = "closed";
  hand.handUntil = now;
  return { ok: true };
}

export function beginOpen(hand: HandState, now: number): { ok: true } | { ok: false; message: string } {
  if (hand.hand !== "closed") return { ok: false, message: "Chưa có lon chưa mở." };
  hand.hand = "opening";
  hand.handUntil = now + DRINK.openMs;
  return { ok: true };
}

export function beginDrink(hand: HandState, now: number): { ok: true } | { ok: false; message: string } {
  if (hand.hand !== "open") return { ok: false, message: "Hãy mở lon trước khi uống." };
  hand.hand = "drinking";
  hand.handUntil = now + DRINK.drinkMs;
  return { ok: true };
}

export function cancelDrink(hand: HandState, now: number): { ok: true } | { ok: false; message: string } {
  if (hand.hand === "drinking" && now < hand.handUntil) {
    hand.hand = "open";
    hand.handUntil = now;
    return { ok: true };
  }
  if (hand.hand === "opening") {
    hand.hand = "closed";
    hand.handUntil = now;
    return { ok: true };
  }
  return { ok: false, message: "Không có ngụm nào đang dở." };
}

export function placeCan(world: ServiceWorld, actor: { id: string }, hand: HandState): { ok: true } | { ok: false; message: string } {
  if (hand.hand !== "closed" && hand.hand !== "open" && hand.hand !== "empty") {
    return { ok: false, message: "Không có lon để đặt xuống." };
  }
  const slot = nextCanSlot(world);
  if (!slot) return { ok: false, message: "Bàn không còn chỗ đặt lon." };
  world.props.push({
    id: `can-${actor.id}-${world.props.length}`,
    kind: "can",
    x: slot.x,
    z: slot.z,
    remaining: 0,
    ownerId: actor.id,
    status: hand.hand === "closed" ? "closed" : hand.hand,
    tableId: "lounge",
  });
  hand.hand = "";
  hand.handUntil = 0;
  return { ok: true };
}

export function discardCan(hand: HandState): { ok: true } | { ok: false; message: string } {
  if (hand.hand !== "empty" && hand.hand !== "closed" && hand.hand !== "open") {
    return { ok: false, message: "Không có lon để bỏ." };
  }
  hand.hand = "";
  hand.handUntil = 0;
  return { ok: true };
}

export function tickHand(hand: HandState, now: number, dt: number, seated: boolean): { consumed: boolean } {
  if (hand.hand === "opening" && now >= hand.handUntil) hand.hand = "open";
  if (hand.hand === "drinking" && now >= hand.handUntil) {
    hand.hand = "empty";
    hand.drunkLevel = Math.min(DRINK.drunkLevelMax, hand.drunkLevel + 1);
    hand.cansDrunk += 1;
    return { consumed: true };
  }
  if (hand.hand !== "drinking" && hand.drunkLevel > 0) {
    const rate = DRINK.recoveryPerSecond * (seated ? DRINK.sittingRecoveryMultiplier : 1);
    hand.drunkLevel = Math.max(0, hand.drunkLevel - rate * dt);
  }
  return { consumed: false };
}

function nearestCrate(world: ServiceWorld, x: number, z: number) {
  let best: (typeof world.props)[number] | null = null;
  let bestDist: number = DRINK.crateReach;
  for (const prop of world.props) {
    if (prop.kind !== "beer") continue;
    const dist = Math.hypot(prop.x - x, prop.z - z);
    if (dist > bestDist) continue;
    best = prop;
    bestDist = dist;
  }
  return best;
}
