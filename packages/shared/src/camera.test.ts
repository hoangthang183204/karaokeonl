import { describe, expect, it } from "vitest";
import { cameraRelativeDirection, facingYaw } from "./camera";

function dir(yaw: number, forward: number, strafe: number) {
  const value = cameraRelativeDirection(yaw, forward, strafe);
  expect(value).not.toBeNull();
  return value!;
}

describe("camera relative movement", () => {
  it("moves toward the TV when the camera looks north", () => {
    const next = dir(Math.PI, 1, 0);
    expect(next.x).toBeCloseTo(0, 5);
    expect(next.z).toBeCloseTo(-1, 5);
    expect(facingYaw(next.x, next.z)).toBeCloseTo(Math.PI, 5);
  });

  it("turns the strafe and forward with the camera", () => {
    const east = dir(Math.PI / 2, 1, 0);
    expect(east.x).toBeCloseTo(1, 5);
    expect(east.z).toBeCloseTo(0, 5);
    expect(dir(Math.PI / 2, 0, 1).z).toBeCloseTo(1, 5);

    const south = dir(0, 1, 0);
    expect(south.z).toBeCloseTo(1, 5);
    expect(dir(0, 0, 1).x).toBeCloseTo(-1, 5);

    const west = dir(-Math.PI / 2, 1, 0);
    expect(west.x).toBeCloseTo(-1, 5);
    expect(dir(-Math.PI / 2, 0, 1).z).toBeCloseTo(-1, 5);
  });

  it("keeps diagonal movement at the same speed as straight movement", () => {
    const diagonal = dir(Math.PI, 1, 1);
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(1, 5);
    expect(diagonal.x).toBeGreaterThan(0);
    expect(diagonal.z).toBeLessThan(0);
  });
});
