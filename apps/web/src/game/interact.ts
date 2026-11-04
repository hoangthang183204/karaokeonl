import { DRINK, SEATS, WEAPON_RACK, nearestProp, type InteractTarget } from "@karaoke/shared";
import { interactHud, localMotion, propBodies, remoteBodies, roomFlags } from "./runtime";
import { useTv } from "@/stores/tv.store";

export function seatOccupied(seatId: string): boolean {
  if (localMotion.seated && localMotion.seatId === seatId) return true;
  for (const body of remoteBodies.values()) {
    if (body.seated && body.seatId === seatId) return true;
  }
  return false;
}

function beerInteract(): InteractTarget | null {
  if (localMotion.hand === "closed") return { id: "hand", kind: "beer", label: "Mở lon" };
  if (localMotion.hand === "open") return { id: "hand", kind: "beer", label: "Uống" };
  if (localMotion.hand === "opening" || localMotion.hand === "drinking") return { id: "hand", kind: "beer", label: "Hủy" };
  if (localMotion.hand === "empty") return { id: "hand", kind: "beer", label: "Bỏ lon rỗng" };
  if (localMotion.seated) return null;
  let crate: { id: string; x: number; z: number; remaining: number } | null = null;
  let best: number = DRINK.crateReach;
  for (const prop of propBodies.values()) {
    if (prop.kind !== "beer") continue;
    const dist = Math.hypot(prop.x - localMotion.x, prop.z - localMotion.z);
    if (dist < best) {
      best = dist;
      crate = prop;
    }
  }
  if (!crate || best > 1.8) return null;
  if (crate.remaining <= 0) return { id: crate.id, kind: "beer", label: "Thùng bia đã hết" };
  return { id: crate.id, kind: "beer", label: "Lấy một lon" };
}

export function currentInteract(): InteractTarget | null {
  const beer = beerInteract();
  if (beer) return beer;
  if (!localMotion.seated && Math.hypot(localMotion.x - WEAPON_RACK.x, localMotion.z - WEAPON_RACK.z) <= WEAPON_RACK.reach) {
    const label = localMotion.weapon ? "Cất gậy" : roomFlags.weaponStock > 0 ? "Lấy gậy" : "Tủ gậy đã hết";
    return { id: "rack", kind: "weapon", label };
  }
  if (localMotion.seated) return nearestProp(localMotion.x, localMotion.z, true, localMotion.seatId);
  const prop = nearestProp(localMotion.x, localMotion.z, false, "");
  if (prop?.kind === "seat" && seatOccupied(prop.id)) {
    let fallback: InteractTarget | null = null;
    let fallbackDist = Infinity;
    for (const seat of SEATS) {
      if (seatOccupied(seat.id)) continue;
      const dist = Math.hypot(localMotion.x - seat.x, localMotion.z - seat.z);
      if (dist > 1.15 || dist >= fallbackDist) continue;
      fallback = { id: seat.id, kind: "seat", label: seat.label };
      fallbackDist = dist;
    }
    if (fallback) return fallback;
  } else if (prop) return prop;
  if (localMotion.seated) return null;
  let nearest: { id: string; name: string; dist: number } | null = null;
  for (const body of remoteBodies.values()) {
    const dist = Math.hypot(body.x - localMotion.x, body.z - localMotion.z);
    if (dist > 1.35) continue;
    if (!nearest || dist < nearest.dist) nearest = { id: body.id, name: body.name, dist };
  }
  if (!nearest) return null;
  return { id: nearest.id, kind: "player", label: `Chào ${nearest.name}` };
}

export function refreshInteract() {
  if (localMotion.hpState === "knocked_out" || localMotion.hpState === "recovering") {
    interactHud.label = "";
    return;
  }
  interactHud.label = currentInteract()?.label ?? "";
}

export function performInteract() {
  if (localMotion.hpState === "knocked_out" || localMotion.hpState === "recovering") return;
  const target = currentInteract();
  if (!target) return;
  if (target.kind === "seat" && localMotion.seated) {
    localMotion.seated = false;
    localMotion.seatId = "";
    localMotion.stoodUntil = performance.now() + 500;
    localMotion.motion = "stand";
    useTv.getState().send("player:sit", { seatId: "" });
    return;
  }
  if (target.kind === "seat") {
    const seat = SEATS.find((item) => item.id === target.id);
    if (!seat || seatOccupied(seat.id)) return;
    localMotion.x = seat.x;
    localMotion.z = seat.z;
    localMotion.rot = seat.rot;
    localMotion.seated = true;
    localMotion.seatId = target.id;
    localMotion.y = 0;
    localMotion.vy = 0;
    localMotion.motion = "sit";
    useTv.getState().send("player:sit", { seatId: target.id });
    return;
  }
  if (target.kind === "tv") {
    window.dispatchEvent(new CustomEvent("karaoke-open-search"));
    return;
  }
  if (target.kind === "stage") {
    localMotion.singing = true;
    window.dispatchEvent(new CustomEvent("karaoke-open-search"));
    return;
  }
  if (target.kind === "mic") {
    window.dispatchEvent(new CustomEvent("karaoke-toggle-mic"));
    return;
  }
  if (target.kind === "console") {
    window.dispatchEvent(new CustomEvent("karaoke-open-console"));
    return;
  }
  if (target.kind === "service") {
    window.dispatchEvent(new CustomEvent("karaoke-open-service"));
    return;
  }
  if (target.kind === "weapon") {
    if (target.label === "Tủ gậy đã hết") return;
    localMotion.action = "pickup";
    localMotion.actionUntil = Date.now() + 700;
    useTv.getState().send(localMotion.weapon ? "weapon:store" : "weapon:take", {});
    return;
  }
  if (target.kind === "beer") {
    const send = useTv.getState().send;
    if (target.label === "Lấy một lon") {
      localMotion.action = "pickup";
      localMotion.actionUntil = Date.now() + 700;
      send("beer:take", {});
      return;
    }
    if (target.label === "Mở lon") {
      localMotion.action = "open";
      localMotion.actionUntil = Date.now() + 700;
      send("beer:open", {});
      return;
    }
    if (target.label === "Uống") {
      localMotion.action = "drink";
      localMotion.actionUntil = Date.now() + 2200;
      send("beer:drink", {});
      return;
    }
    if (target.label === "Hủy") {
      localMotion.action = "";
      send("beer:cancel", {});
      return;
    }
    if (target.label === "Bỏ lon rỗng") {
      send("beer:discard", {});
      return;
    }
    window.dispatchEvent(new CustomEvent("karaoke-open-service"));
    return;
  }
  useTv.getState().send("player:emote", { emote: "wave" });
  localMotion.emote = "wave";
  localMotion.emoteUntil = Date.now() + 2600;
}
