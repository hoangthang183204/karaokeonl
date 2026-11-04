export interface SeatSpot {
  id: string;
  x: number;
  y: number;
  z: number;
  /** Góc Y của avatar. Mặt khối là +Z: PI nhìn TV (-Z), PI/2 nhìn +X. */
  rot: number;
  side: "left" | "right" | "back";
  label: string;
}

/** Module sofa. yaw xoay local +Z vào phía trong chữ U. Tựa lưng nằm ở local -Z. */
export interface SofaRun {
  id: string;
  x: number;
  z: number;
  length: number;
  yaw: number;
}

export const LOUNGE_TABLE = { x: 0, z: 3.55, halfX: 0.72, halfZ: 0.42, topY: 0.5 };

export const SOFA_RUNS: readonly SofaRun[] = [
  { id: "sofa-left", x: -3.15, z: 3.55, length: 2.7, yaw: Math.PI / 2 },
  { id: "sofa-right", x: 3.15, z: 3.55, length: 2.7, yaw: -Math.PI / 2 },
  { id: "sofa-back", x: 0, z: 5.15, length: 7.2, yaw: Math.PI },
];

function sofaPoint(run: SofaRun, along: number, inward: number): { x: number; z: number } {
  const cos = Math.cos(run.yaw);
  const sin = Math.sin(run.yaw);
  return {
    x: run.x + along * cos + inward * sin,
    z: run.z - along * sin + inward * cos,
  };
}

function seatOn(run: SofaRun, along: number, id: string, side: SeatSpot["side"]): SeatSpot {
  const point = sofaPoint(run, along, 0.4);
  return {
    id,
    x: Math.round(point.x * 100) / 100,
    y: 0,
    z: Math.round(point.z * 100) / 100,
    rot: run.yaw,
    side,
    label: "Ngồi · trống",
  };
}

export const SEATS: readonly SeatSpot[] = [
  seatOn(SOFA_RUNS[0], 0, "seat-1", "left"),
  seatOn(SOFA_RUNS[1], 0, "seat-2", "right"),
  seatOn(SOFA_RUNS[2], -0.5, "seat-3", "back"),
  seatOn(SOFA_RUNS[2], 0.5, "seat-4", "back"),
];

export const ROOM_BOUNDS = {
  minX: -9.2,
  maxX: 9.2,
  minZ: -6.4,
  maxZ: 7.9,
};

export const STAGE = { minX: -2.6, maxX: 2.6, minZ: -5.5, maxZ: -4.05 };
export const MIC_POINT = { x: 0, z: -4.7 };
export const TV_POINT = { x: 0, z: -5.85 };
export const SERVICE_COUNTER = { x: 6.55, z: 6.15 };
export const DANCER_REST = { x: 5.6, z: -2.6 };

export const WALK_SPEED = 2.7;
export const RUN_SPEED = 5.1;
export const JUMP_SPEED = 4.4;
export const GRAVITY = 12;
export const PLAYER_RADIUS = 0.28;
export const PLAYER_GAP = 0.52;

export const EMOTES = ["wave", "clap", "laugh", "heart", "dance", "cheer"] as const;
export type EmoteId = (typeof EMOTES)[number];

export const MOTIONS = ["idle", "walk", "run", "jump", "sit", "stand", "sing", "dance", "wave", "clap", "punch", "push", "dodge", "block", "stagger", "lie", "taunt"] as const;
export type MotionId = (typeof MOTIONS)[number];

export const OUTFITS = ["hoodie", "vest"] as const;
export type OutfitId = (typeof OUTFITS)[number];

export const LOOK_COLORS = ["#c084fc", "#67e8f9", "#f472b6", "#facc15", "#34d399", "#fb7185"] as const;

export interface Aabb {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function sofaAabb(run: SofaRun, minAlong: number, maxAlong: number, minInward: number, maxInward: number, id: string): Aabb {
  const corners = [
    sofaPoint(run, minAlong, minInward),
    sofaPoint(run, minAlong, maxInward),
    sofaPoint(run, maxAlong, minInward),
    sofaPoint(run, maxAlong, maxInward),
  ];
  return {
    id,
    minX: Math.min(...corners.map((point) => point.x)),
    maxX: Math.max(...corners.map((point) => point.x)),
    minZ: Math.min(...corners.map((point) => point.z)),
    maxZ: Math.max(...corners.map((point) => point.z)),
  };
}

function sofaColliders(run: SofaRun): Aabb[] {
  const half = run.length / 2;
  return [
    sofaAabb(run, -half, half, -0.42, -0.2, `${run.id}-back`),
    sofaAabb(run, -half + 0.12, half - 0.12, -0.2, 0.02, `${run.id}-pad`),
    sofaAabb(run, -half, -half + 0.18, -0.16, 0.2, `${run.id}-arm-a`),
    sofaAabb(run, half - 0.18, half, -0.16, 0.2, `${run.id}-arm-b`),
  ];
}

export const OBSTACLES: readonly Aabb[] = [
  ...SOFA_RUNS.flatMap(sofaColliders),
  {
    id: "table",
    minX: LOUNGE_TABLE.x - LOUNGE_TABLE.halfX,
    maxX: LOUNGE_TABLE.x + LOUNGE_TABLE.halfX,
    minZ: LOUNGE_TABLE.z - LOUNGE_TABLE.halfZ,
    maxZ: LOUNGE_TABLE.z + LOUNGE_TABLE.halfZ,
  },
  { id: "speaker-l", minX: -5.6, maxX: -4.8, minZ: -5.6, maxZ: -4.8 },
  { id: "speaker-r", minX: 4.8, maxX: 5.6, minZ: -5.6, maxZ: -4.8 },
  { id: "cabinet", minX: -8.8, maxX: -8.0, minZ: 6.05, maxZ: 6.95 },
  { id: "mic-stand", minX: -0.16, maxX: 0.16, minZ: -4.9, maxZ: -4.5 },
];

export function clampRoomPosition(x: number, z: number): { x: number; z: number } {
  return {
    x: Math.min(ROOM_BOUNDS.maxX, Math.max(ROOM_BOUNDS.minX, x)),
    z: Math.min(ROOM_BOUNDS.maxZ, Math.max(ROOM_BOUNDS.minZ, z)),
  };
}

export function isBlocked(x: number, z: number, radius = PLAYER_RADIUS): boolean {
  if (x < ROOM_BOUNDS.minX + radius || x > ROOM_BOUNDS.maxX - radius) return true;
  if (z < ROOM_BOUNDS.minZ + radius || z > ROOM_BOUNDS.maxZ - radius) return true;
  return OBSTACLES.some(
    (box) => x > box.minX - radius && x < box.maxX + radius && z > box.minZ - radius && z < box.maxZ + radius,
  );
}

export function slidePosition(x: number, z: number, nextX: number, nextZ: number, radius = PLAYER_RADIUS): { x: number; z: number } {
  if (!isBlocked(nextX, nextZ, radius)) return { x: nextX, z: nextZ };
  if (!isBlocked(nextX, z, radius)) return { x: nextX, z };
  if (!isBlocked(x, nextZ, radius)) return { x, z: nextZ };
  return { x, z };
}

export function resolvePlayerMove(
  prev: { x: number; z: number },
  requested: { x: number; z: number },
  dt: number,
  running: boolean,
  others: { x: number; z: number }[] = [],
): { x: number; z: number } {
  const step = Math.min(Math.max(dt, 0.016), 0.3);
  const max = (running ? RUN_SPEED : WALK_SPEED) * step + 0.22;
  let dx = requested.x - prev.x;
  let dz = requested.z - prev.z;
  const dist = Math.hypot(dx, dz);
  if (dist > max && dist > 0) {
    dx = (dx / dist) * max;
    dz = (dz / dist) * max;
  }
  const slid = slidePosition(prev.x, prev.z, prev.x + dx, prev.z + dz);
  return separatePlayers(slid, others);
}

function separatePlayers(point: { x: number; z: number }, others: { x: number; z: number }[]): { x: number; z: number } {
  let x = point.x;
  let z = point.z;
  for (const other of others) {
    let dx = x - other.x;
    let dz = z - other.z;
    let dist = Math.hypot(dx, dz);
    if (dist >= PLAYER_GAP) continue;
    if (dist < 0.001) {
      dx = 1;
      dz = 0;
      dist = 1;
    }
    const push = PLAYER_GAP - dist;
    const candidate = slidePosition(x, z, x + (dx / dist) * push, z + (dz / dist) * push);
    x = candidate.x;
    z = candidate.z;
  }
  return { x, z };
}

export function onStage(x: number, z: number): boolean {
  return x >= STAGE.minX && x <= STAGE.maxX && z >= STAGE.minZ && z <= STAGE.maxZ;
}

export function cameraPull(px: number, pz: number, cx: number, cz: number): { x: number; z: number } {
  const dx = cx - px;
  const dz = cz - pz;
  const len = Math.hypot(dx, dz);
  if (len < 0.001 || !isBlocked(cx, cz, 0.2)) return { x: cx, z: cz };
  let lo = 0;
  let hi = len;
  for (let i = 0; i < 8; i += 1) {
    const mid = (lo + hi) / 2;
    const x = px + (dx / len) * mid;
    const z = pz + (dz / len) * mid;
    if (isBlocked(x, z, 0.2)) hi = mid;
    else lo = mid;
  }
  return { x: px + (dx / len) * lo, z: pz + (dz / len) * lo };
}

export interface InteractTarget {
  id: string;
  kind: "seat" | "tv" | "stage" | "mic" | "console" | "player" | "service" | "beer";
  label: string;
}

export function nearestProp(x: number, z: number, seated: boolean, seatId: string): InteractTarget | null {
  if (seated) {
    const seat = SEATS.find((item) => item.id === seatId) ?? SEATS[0];
    return { id: seat.id, kind: "seat", label: "Đứng dậy" };
  }
  const options: { target: InteractTarget; x: number; z: number; radius: number }[] = [
    ...SEATS.map((seat) => ({ target: { id: seat.id, kind: "seat" as const, label: seat.label }, x: seat.x, z: seat.z, radius: 1.15 })),
    { target: { id: "mic", kind: "mic", label: "Cầm micro" }, x: MIC_POINT.x, z: MIC_POINT.z, radius: 1.15 },
    { target: { id: "stage", kind: "stage", label: "Đăng ký hát" }, x: 0, z: -4.7, radius: 1.35 },
    { target: { id: "tv", kind: "tv", label: "Chọn bài" }, x: TV_POINT.x, z: TV_POINT.z, radius: 1.7 },
    { target: { id: "console", kind: "console", label: "Mở bàn karaoke" }, x: -6.3, z: 6.4, radius: 1.2 },
    { target: { id: "counter", kind: "service", label: "Gọi phục vụ" }, x: SERVICE_COUNTER.x, z: SERVICE_COUNTER.z, radius: 1.45 },
  ];
  let best: InteractTarget | null = null;
  let bestDist = Infinity;
  for (const option of options) {
    const dist = Math.hypot(x - option.x, z - option.z);
    if (dist > option.radius || dist >= bestDist) continue;
    best = option.target;
    bestDist = dist;
  }
  return best;
}

export function isMotion(value: string): value is MotionId {
  return (MOTIONS as readonly string[]).includes(value);
}

export function isOutfit(value: string): value is OutfitId {
  return (OUTFITS as readonly string[]).includes(value);
}
