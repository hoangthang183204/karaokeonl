/** Hướng mặt của nhân vật khối là trục +Z. Không cộng thêm offset. */
export function facingYaw(x: number, z: number): number {
  return Math.atan2(x, z);
}

/**
 * yaw là hướng camera nhìn trên mặt phẳng XZ.
 * yaw = 0 nhìn +Z, yaw = PI nhìn -Z (về phía TV).
 * right = forward × up, đúng tay phải của Three.js.
 */
export function cameraBasis(yaw: number): { forwardX: number; forwardZ: number; rightX: number; rightZ: number } {
  const forwardX = Math.sin(yaw);
  const forwardZ = Math.cos(yaw);
  return {
    forwardX,
    forwardZ,
    rightX: -forwardZ,
    rightZ: forwardX,
  };
}

export function cameraRelativeDirection(yaw: number, forward: number, strafe: number): { x: number; z: number } | null {
  const basis = cameraBasis(yaw);
  const x = basis.forwardX * forward + basis.rightX * strafe;
  const z = basis.forwardZ * forward + basis.rightZ * strafe;
  const length = Math.hypot(x, z);
  if (length < 0.001) return null;
  return { x: x / length, z: z / length };
}
