import { describe, expect, it } from "vitest";
import { OBSTACLES, PLAYER_RADIUS, ROOM_BOUNDS, SEATS, cameraPull, isBlocked, nearestProp, resolvePlayerMove, slidePosition } from "./world";

describe("room movement", () => {
  it("slides along a wall instead of leaving the room", () => {
    const next = slidePosition(-8.5, 1, -12, 1.2);
    expect(next.x).toBeGreaterThan(ROOM_BOUNDS.minX + PLAYER_RADIUS - 0.05);
    expect(isBlocked(next.x, next.z)).toBe(false);
    expect(next.z).toBeCloseTo(1.2, 1);
  });

  it("does not pass through the coffee table", () => {
    const table = OBSTACLES.find((item) => item.id === "table");
    expect(table).toBeTruthy();
    const start = { x: 0, z: table!.minZ - 0.9 };
    const next = resolvePlayerMove(start, { x: start.x, z: start.z + 2 }, 0.2, true);
    expect(isBlocked(start.x, start.z)).toBe(false);
    expect(isBlocked(next.x, next.z)).toBe(false);
    expect(next.z).toBeLessThan(table!.minZ);
  });

  it("caps a teleport to one running step", () => {
    const next = resolvePlayerMove({ x: 0, z: -1.4 }, { x: 8, z: -1.4 }, 0.1, true);
    expect(Math.hypot(next.x, next.z + 1.4)).toBeLessThan(1.1);
  });

  it("keeps two players from occupying the same spot", () => {
    const next = resolvePlayerMove({ x: 0, z: -1.5 }, { x: 0.1, z: -1.5 }, 0.1, false, [{ x: 0.15, z: -1.5 }]);
    expect(Math.hypot(next.x - 0.15, next.z + 1.5)).toBeGreaterThan(0.45);
  });

  it("pulls the camera back inside the room", () => {
    const camera = cameraPull(0, 3, 0, 9);
    expect(isBlocked(camera.x, camera.z, 0.2)).toBe(false);
  });

  it("offers a seat when standing beside one and stand-up when seated", () => {
    const seat = SEATS[0];
    expect(nearestProp(seat.x, seat.z, false, "")?.id).toBe(seat.id);
    expect(nearestProp(seat.x, seat.z, true, seat.id)?.label).toBe("Đứng dậy");
  });

  it("keeps the U lounge seats outside the sofa and the table", () => {
    for (const seat of SEATS) expect(isBlocked(seat.x, seat.z)).toBe(false);
    const back = SEATS.filter((seat) => seat.side === "back");
    const sides = SEATS.filter((seat) => seat.side !== "back");
    expect(back).toHaveLength(2);
    expect(sides).toHaveLength(2);
    expect(back.every((seat) => Math.abs(seat.rot - Math.PI) < 0.01)).toBe(true);
    expect(sides.map((seat) => Math.sign(seat.x)).sort()).toEqual([-1, 1]);
    expect(Math.abs(sides[0].rot + sides[1].rot)).toBeLessThan(0.01);
    expect(isBlocked(0, 6.6)).toBe(false);
    expect(isBlocked(7.2, 1.4, 0.22)).toBe(false);
    expect(isBlocked(0, 1.4, 0.22)).toBe(false);
  });
});
