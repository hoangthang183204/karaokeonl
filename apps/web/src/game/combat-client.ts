import type { CombatAction } from "@karaoke/shared";
import { useTv } from "@/stores/tv.store";
import { localMotion, remoteBodies, roomFlags } from "./runtime";

let lastSent = 0;

export function sendCombat(action: CombatAction) {
  const now = Date.now();
  if (now - lastSent < 280) return;
  lastSent = now;
  if (!roomFlags.pvp) return;
  if (localMotion.hpState === "knocked_out" || localMotion.hpState === "recovering") return;
  let targetId = "";
  if (action === "swing") {
    let best = 8;
    for (const body of remoteBodies.values()) {
      const dist = Math.hypot(body.x - localMotion.x, body.z - localMotion.z);
      if (dist >= best) continue;
      best = dist;
      targetId = body.id;
    }
  }
  useTv.getState().send("combat:act", { action, targetId });
}
