import { describe, expect, it } from "vitest";
import { isBlocked } from "./world";
import { controlService, emptyServiceWorld, requestService, tickServices } from "./npc";
import { beginDrink, beginOpen, cancelDrink, emptyHand, takeCan, tickHand } from "./drink";

function settle(world: ReturnType<typeof emptyServiceWorld>, now: number, untilIdle = true) {
  for (let i = 0; i < 400; i += 1) {
    now += 100;
    tickServices(world, now, 0.1);
    for (const npc of world.npcs) expect(isBlocked(npc.x, npc.z, 0.22)).toBe(false);
    if (untilIdle && world.npcs.every((npc) => npc.phase === "idle") && world.orders.every((order) => order.status === "completed" || order.status === "cancelled")) break;
  }
  return now;
}

describe("npc services", () => {
  it("keeps one waiter and delivers a drink back to the counter", () => {
    const world = emptyServiceWorld();
    expect(requestService(world, { userId: "mai", service: "juice", now: 0 }).ok).toBe(true);
    const now = settle(world, 0);
    expect(world.props.some((prop) => prop.kind === "juice")).toBe(true);
    expect(world.npcs.filter((npc) => npc.role === "server")).toHaveLength(1);
    expect(world.npcs.find((npc) => npc.id === "waiter")?.phase).toBe("idle");
    expect(requestService(world, { userId: "lan", service: "water", now: now + 1 }).ok).toBe(true);
    settle(world, now + 1);
    expect(world.props.some((prop) => prop.kind === "water")).toBe(true);
    expect(requestService(world, { userId: "mai", service: "clear", now: now + 30_000 }).ok).toBe(true);
    settle(world, now + 30_000);
    expect(world.props.filter((prop) => prop.kind !== "beer")).toHaveLength(0);
  });

  it("queues a second order until the waiter is free", () => {
    const world = emptyServiceWorld();
    expect(requestService(world, { userId: "mai", service: "juice", now: 1_000 }).ok).toBe(true);
    expect(requestService(world, { userId: "lan", service: "snack", now: 1_100 }).ok).toBe(true);
    expect(world.npcs.filter((npc) => npc.role === "server")).toHaveLength(1);
    expect(world.orders.some((order) => order.status === "pending")).toBe(true);
    settle(world, 1_100);
    expect(world.props.map((prop) => prop.kind).sort()).toEqual(["juice", "snack"]);
  });

  it("rejects a second call during cooldown and a fake service", () => {
    const world = emptyServiceWorld();
    expect(requestService(world, { userId: "mai", service: "water", now: 5_000 }).ok).toBe(true);
    expect(requestService(world, { userId: "mai", service: "snack", now: 6_000 }).ok).toBe(false);
    expect(requestService(world, { userId: "lan", service: "not-a-drink", now: 6_000 }).ok).toBe(false);
  });

  it("sends the dancer to the stage once and reuses her", () => {
    const world = emptyServiceWorld();
    expect(requestService(world, { userId: "mai", service: "dance", now: 1_000, spot: "stage", style: "loop2" }).ok).toBe(true);
    const dancer = world.npcs.find((npc) => npc.id === "dancer");
    expect(dancer?.style).toBe("loop2");
    expect(requestService(world, { userId: "lan", service: "dance", now: 2_000, spot: "table" }).ok).toBe(false);
    let now = 1_000;
    for (let i = 0; i < 200 && dancer?.phase === "walk"; i += 1) {
      now += 100;
      tickServices(world, now, 0.1);
    }
    expect(dancer?.phase === "greet" || dancer?.phase === "work").toBe(true);
    expect(controlService(world, { userId: "lan", role: "member", action: "end", now }).ok).toBe(false);
    expect(controlService(world, { userId: "mai", role: "member", action: "pause", now }).ok).toBe(true);
    expect(dancer?.paused).toBe(true);
    expect(controlService(world, { userId: "mai", role: "member", action: "end", now }).ok).toBe(true);
    settle(world, now);
    expect(dancer?.phase).toBe("idle");
    expect(world.npcs.filter((npc) => npc.role === "dancer")).toHaveLength(1);
    expect(requestService(world, { userId: "mai", service: "dance", now: now + 40_000, spot: "table" }).ok).toBe(true);
    expect(world.npcs.filter((npc) => npc.role === "dancer")).toHaveLength(1);
  });
});

describe("beer and drunk", () => {
  it("delivers 24 cans and only counts a finished drink", () => {
    const world = emptyServiceWorld();
    expect(requestService(world, { userId: "mai", service: "beer", now: 0 }).ok).toBe(true);
    settle(world, 0);
    const crate = world.props.find((prop) => prop.kind === "beer");
    expect(crate?.remaining).toBe(24);
    expect(crate?.status).toBe("full");
    const hand = emptyHand();
    expect(takeCan(world, { id: "lan", x: 0, z: 3.5, role: "member" }, hand, 10_000).ok).toBe(false);
    expect(takeCan(world, { id: "mai", x: 0, z: 3.5, role: "member" }, hand, 10_000).ok).toBe(true);
    expect(crate?.remaining).toBe(23);
    expect(takeCan(world, { id: "mai", x: 0, z: 3.5, role: "member" }, hand, 10_100).ok).toBe(false);
    expect(beginDrink(hand, 10_200).ok).toBe(false);
    expect(beginOpen(hand, 10_200).ok).toBe(true);
    tickHand(hand, 10_200 + 700, 0.1, false);
    expect(hand.hand).toBe("open");
    expect(beginDrink(hand, 11_000).ok).toBe(true);
    expect(tickHand(hand, 11_100, 0.1, false).consumed).toBe(false);
    expect(hand.drunkLevel).toBe(0);
    expect(cancelDrink(hand, 11_200).ok).toBe(true);
    expect(beginDrink(hand, 11_300).ok).toBe(true);
    expect(tickHand(hand, 11_300 + 2200, 0.1, false).consumed).toBe(true);
    expect(hand.drunkLevel).toBe(1);
    expect(hand.cansDrunk).toBe(1);
    expect(hand.hand).toBe("empty");
    tickHand(hand, 20_000, 10, true);
    expect(hand.drunkLevel).toBeLessThan(1);
  });
});
