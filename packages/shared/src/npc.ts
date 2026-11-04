import { facingYaw } from "./camera";
import { DRINK } from "./service-config";
import { DANCER_REST, LOUNGE_TABLE, SERVICE_COUNTER, isBlocked, slidePosition } from "./world";

export const SERVICES = ["dance", "beer", "juice", "water", "soda", "fruit", "snack", "clear"] as const;
export type ServiceId = (typeof SERVICES)[number];
export type OrderStatus = "pending" | "accepted" | "serving" | "completed" | "cancelled";
export type DanceSpot = "stage" | "table";
export type DanceStyle = "loop1" | "loop2" | "loop3";

export const MAX_NPCS = 4;
export const MAX_PROPS = 6;
export const MAX_DANCERS = 1;
export const SERVICE_COOLDOWN_MS = 8000;
const NPC_SPEED = 1.7;
const SERVER_WORK_MS = 900;
const TABLE_ID = "lounge";

const SERVE_PATH = [
  SERVICE_COUNTER,
  { x: 7, z: 6.15 },
  { x: 7, z: 1.35 },
  { x: 0, z: 1.35 },
  { x: 0, z: LOUNGE_TABLE.z - 1.15 },
];
const STAGE_SPOT = { x: -1.2, z: -4.7 };
const TABLE_SPOT = { x: 1.15, z: 2.35 };
const TABLE_SLOTS = [
  { x: LOUNGE_TABLE.x - 0.28, z: LOUNGE_TABLE.z - 0.1 },
  { x: LOUNGE_TABLE.x + 0.02, z: LOUNGE_TABLE.z - 0.14 },
  { x: LOUNGE_TABLE.x + 0.28, z: LOUNGE_TABLE.z - 0.02 },
  { x: LOUNGE_TABLE.x - 0.08, z: LOUNGE_TABLE.z + 0.12 },
  { x: LOUNGE_TABLE.x + 0.22, z: LOUNGE_TABLE.z + 0.14 },
  { x: LOUNGE_TABLE.x - 0.32, z: LOUNGE_TABLE.z + 0.16 },
];
const CAN_SLOTS = [
  { x: -0.46, z: 3.28 },
  { x: 0.46, z: 3.28 },
  { x: -0.46, z: 3.82 },
  { x: 0.46, z: 3.82 },
  { x: -0.18, z: 3.95 },
  { x: 0.18, z: 3.95 },
  { x: -0.34, z: 3.48 },
  { x: 0.34, z: 3.48 },
];

export interface NpcSim {
  id: string;
  role: "dancer" | "server";
  service: ServiceId | "";
  x: number;
  z: number;
  rot: number;
  phase: "idle" | "walk" | "greet" | "work" | "leave";
  cursor: number;
  workUntil: number;
  greetUntil: number;
  goalX: number;
  goalZ: number;
  homeX: number;
  homeZ: number;
  stuck: number;
  label: string;
  ownerId: string;
  requestId: string;
  spot: DanceSpot | "";
  style: DanceStyle | "";
  paused: boolean;
}

export interface PropSim {
  id: string;
  kind: string;
  x: number;
  z: number;
  remaining: number;
  ownerId: string;
  status: string;
  tableId: string;
}

export interface ServiceOrder {
  requestId: string;
  playerId: string;
  service: ServiceId;
  status: OrderStatus;
  createdAt: number;
  spot: DanceSpot | "";
  style: DanceStyle | "";
  tableId: string;
}

export interface ServiceWorld {
  npcs: NpcSim[];
  props: PropSim[];
  orders: ServiceOrder[];
  cooldowns: Record<string, number>;
}

export function emptyServiceWorld(): ServiceWorld {
  return { npcs: [], props: [], orders: [], cooldowns: {} };
}

export function isService(value: string): value is ServiceId {
  return (SERVICES as readonly string[]).includes(value);
}

export function ensureStaff(world: ServiceWorld) {
  if (world.npcs.some((npc) => npc.id === "waiter")) return;
  world.npcs.push(staff("waiter", "server", "Phục vụ", SERVICE_COUNTER));
}

export function requestService(
  world: ServiceWorld,
  input: { userId: string; service: string; now: number; spot?: string; style?: string },
): { ok: true; requestId: string } | { ok: false; message: string } {
  const service = input.service;
  if (!isService(service)) return { ok: false, message: "Dịch vụ không có trong menu." };
  const readyAt = world.cooldowns[input.userId] ?? 0;
  if (input.now < readyAt) return { ok: false, message: "Hãy chờ một chút trước khi gọi tiếp." };
  ensureStaff(world);
  if (service === "dance") return startDance(world, input);
  if (service === "clear") {
    const clutter = world.props.some((prop) => prop.kind !== "beer" || prop.status === "empty");
    if (!clutter) return { ok: false, message: "Trên bàn chưa có gì để thu dọn." };
  }
  if (service === "beer") {
    const live = world.props.find((prop) => prop.kind === "beer" && prop.status !== "empty");
    if (live) return { ok: false, message: "Bàn đang có thùng bia. Hãy uống hết trước khi gọi thùng mới." };
  }
  if (service !== "clear" && service !== "beer") {
    const drinks = world.props.filter((prop) => prop.kind !== "beer" && prop.kind !== "can").length;
    if (drinks >= MAX_PROPS) return { ok: false, message: "Bàn đã đầy. Hãy gọi thu dọn trước." };
  }
  const order = enqueue(world, { ...input, service });
  assignWaiter(world);
  return { ok: true, requestId: order.requestId };
}

export function controlService(
  world: ServiceWorld,
  input: { userId: string; role: string; action: string; now: number },
): { ok: true } | { ok: false; message: string } {
  if (input.action === "cancel") {
    const pending = [...world.orders].reverse().find((order) => order.playerId === input.userId && order.status === "pending");
    if (!pending) return { ok: false, message: "Không có yêu cầu nào đang chờ." };
    pending.status = "cancelled";
    return { ok: true };
  }
  const dancer = world.npcs.find((npc) => npc.id === "dancer");
  if (!dancer || dancer.phase === "idle") return { ok: false, message: "Chưa có vũ công đang biểu diễn." };
  if (!canDirect(input.userId, input.role, dancer.ownerId)) return { ok: false, message: "Chỉ người gọi hoặc host điều khiển vũ công." };
  if (input.action === "pause") {
    if (dancer.phase !== "work" && dancer.phase !== "greet") return { ok: false, message: "Vũ công đang đi tới." };
    dancer.paused = true;
    return { ok: true };
  }
  if (input.action === "resume") {
    dancer.paused = false;
    return { ok: true };
  }
  if (input.action === "end") {
    dancer.phase = "leave";
    dancer.cursor = 1;
    dancer.paused = false;
    dancer.stuck = 0;
    const order = world.orders.find((item) => item.requestId === dancer.requestId);
    if (order && order.status !== "cancelled") order.status = "completed";
    return { ok: true };
  }
  return { ok: false, message: "Thao tác không hỗ trợ." };
}

export function tickServices(world: ServiceWorld, now: number, dt: number): boolean {
  if (world.npcs.length === 0 && world.orders.length === 0) return false;
  const step = Math.min(Math.max(dt, 0.016), 0.2);
  let changed = assignWaiter(world);
  for (const npc of world.npcs) {
    const before = `${npc.phase}:${npc.x.toFixed(3)}:${npc.paused}`;
    advance(world, npc, now, step);
    if (before !== `${npc.phase}:${npc.x.toFixed(3)}:${npc.paused}`) changed = true;
  }
  const beforeOrders = world.orders.length;
  world.orders = world.orders
    .filter((order) => order.status === "pending" || order.status === "accepted" || order.status === "serving" || now - order.createdAt < 30000)
    .slice(-12);
  return changed || world.orders.length !== beforeOrders;
}

export function nextCanSlot(world: ServiceWorld): { x: number; z: number } | null {
  const used = world.props.filter((prop) => prop.kind === "can").length;
  if (used >= DRINK.maxPlacedCans) return null;
  return CAN_SLOTS.find((point) => world.props.every((prop) => Math.hypot(prop.x - point.x, prop.z - point.z) > 0.12)) ?? null;
}

function canDirect(userId: string, role: string, ownerId: string) {
  return userId === ownerId || role === "host" || role === "cohost";
}

function staff(id: string, role: NpcSim["role"], label: string, home: { x: number; z: number }): NpcSim {
  return {
    id,
    role,
    service: "",
    x: home.x,
    z: home.z,
    rot: role === "dancer" ? Math.PI : Math.PI,
    phase: "idle",
    cursor: 0,
    workUntil: 0,
    greetUntil: 0,
    goalX: home.x,
    goalZ: home.z,
    homeX: home.x,
    homeZ: home.z,
    stuck: 0,
    label,
    ownerId: "",
    requestId: "",
    spot: "",
    style: "",
    paused: false,
  };
}

function enqueue(world: ServiceWorld, input: { userId: string; service: ServiceId; now: number; spot?: string; style?: string }): ServiceOrder {
  const order: ServiceOrder = {
    requestId: `ord-${input.now.toString(36)}-${world.orders.length}`,
    playerId: input.userId,
    service: input.service,
    status: "pending",
    createdAt: input.now,
    spot: input.spot === "table" ? "table" : input.spot === "stage" ? "stage" : "",
    style: input.style === "loop2" || input.style === "loop3" ? input.style : input.style === "loop1" ? "loop1" : "",
    tableId: TABLE_ID,
  };
  world.orders.push(order);
  world.cooldowns[input.userId] = input.now + SERVICE_COOLDOWN_MS;
  return order;
}

function startDance(world: ServiceWorld, input: { userId: string; now: number; spot?: string; style?: string }): { ok: true; requestId: string } | { ok: false; message: string } {
  const dancer = world.npcs.find((npc) => npc.id === "dancer");
  if (dancer && dancer.phase !== "idle") return { ok: false, message: "Vũ công đang biểu diễn." };
  const order = enqueue(world, { ...input, service: "dance" });
  const spot = order.spot === "table" ? TABLE_SPOT : STAGE_SPOT;
  order.status = "accepted";
  if (!dancer) {
    const body = staff("dancer", "dancer", "Lan Chi", DANCER_REST);
    body.phase = "walk";
    body.cursor = 1;
    body.service = "dance";
    body.goalX = spot.x;
    body.goalZ = spot.z;
    body.ownerId = input.userId;
    body.requestId = order.requestId;
    body.spot = order.spot === "table" ? "table" : "stage";
    body.style = order.style || "loop1";
    world.npcs.push(body);
    return { ok: true, requestId: order.requestId };
  }
  dancer.phase = "walk";
  dancer.cursor = 1;
  dancer.stuck = 0;
  dancer.service = "dance";
  dancer.goalX = spot.x;
  dancer.goalZ = spot.z;
  dancer.ownerId = input.userId;
  dancer.requestId = order.requestId;
  dancer.spot = order.spot === "table" ? "table" : "stage";
  dancer.style = order.style || "loop1";
  dancer.paused = false;
  return { ok: true, requestId: order.requestId };
}

function assignWaiter(world: ServiceWorld): boolean {
  const waiter = world.npcs.find((npc) => npc.id === "waiter");
  if (!waiter || waiter.phase !== "idle") return false;
  const job = world.orders.find((order) => order.status === "pending" && order.service !== "dance");
  if (!job) return false;
  job.status = "accepted";
  waiter.service = job.service;
  waiter.phase = "walk";
  waiter.cursor = 1;
  waiter.stuck = 0;
  waiter.ownerId = job.playerId;
  waiter.requestId = job.requestId;
  waiter.goalX = SERVE_PATH[SERVE_PATH.length - 1].x;
  waiter.goalZ = SERVE_PATH[SERVE_PATH.length - 1].z;
  waiter.paused = false;
  return true;
}

function route(npc: NpcSim): { x: number; z: number }[] {
  if (npc.role === "dancer") {
    const lane = npc.goalZ < 0 ? -3.5 : 1.35;
    const forward = [
      { x: npc.homeX, z: npc.homeZ },
      { x: 7, z: lane },
      { x: npc.goalX, z: lane },
      { x: npc.goalX, z: npc.goalZ },
    ];
    return npc.phase === "leave" ? [...forward].reverse() : forward;
  }
  return npc.phase === "leave" ? [...SERVE_PATH].reverse() : SERVE_PATH;
}

function advance(world: ServiceWorld, npc: NpcSim, now: number, dt: number) {
  if (npc.phase === "idle") return;
  if (npc.phase === "greet") {
    npc.rot = Math.PI;
    if (now < npc.greetUntil) return;
    npc.phase = "work";
    return;
  }
  if (npc.phase === "work") {
    npc.rot = npc.role === "dancer" ? Math.PI : 0;
    if (npc.paused) {
      npc.workUntil += dt * 1000;
      return;
    }
    if (now < npc.workUntil) return;
    npc.phase = "leave";
    npc.cursor = 1;
    npc.stuck = 0;
    return;
  }
  const path = route(npc);
  const target = path[Math.min(npc.cursor, path.length - 1)];
  const dx = target.x - npc.x;
  const dz = target.z - npc.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.14 || npc.cursor >= path.length) {
    arrive(world, npc, now);
    return;
  }
  const step = Math.min(dist, NPC_SPEED * dt);
  const next = slidePosition(npc.x, npc.z, npc.x + (dx / dist) * step, npc.z + (dz / dist) * step, 0.22);
  const moved = Math.hypot(next.x - npc.x, next.z - npc.z);
  npc.x = next.x;
  npc.z = next.z;
  npc.rot = facingYaw(dx, dz);
  npc.stuck = moved < 0.004 ? npc.stuck + 1 : 0;
  if (npc.stuck > 8) {
    const side = npc.stuck % 16 < 8 ? 1 : -1;
    const nudged = slidePosition(npc.x, npc.z, npc.x + (-dz / dist) * side * 0.45, npc.z + (dx / dist) * side * 0.45, 0.22);
    if (Math.hypot(nudged.x - npc.x, nudged.z - npc.z) > 0.02) {
      npc.x = nudged.x;
      npc.z = nudged.z;
      npc.stuck = 0;
    }
  }
  if (npc.stuck > 36 && dist < 1.1) {
    npc.stuck = 0;
    npc.cursor += 1;
  }
}

function arrive(world: ServiceWorld, npc: NpcSim, now: number) {
  const path = route(npc);
  if (npc.cursor < path.length - 1) {
    npc.cursor += 1;
    npc.stuck = 0;
    return;
  }
  if (npc.phase === "walk") {
    if (!isBlocked(npc.goalX, npc.goalZ, 0.22)) {
      npc.x = npc.goalX;
      npc.z = npc.goalZ;
    }
    const order = world.orders.find((item) => item.requestId === npc.requestId);
    if (order) order.status = "serving";
    if (npc.role === "dancer") {
      npc.phase = "greet";
      npc.greetUntil = now + DRINK.greetMs;
      npc.workUntil = now + DRINK.greetMs + DRINK.dancerWorkMs;
      return;
    }
    npc.phase = "work";
    npc.workUntil = now + SERVER_WORK_MS;
    if (npc.service === "clear") {
      world.props = world.props.filter((prop) => prop.kind === "beer" && prop.status !== "empty");
    } else placeProp(world, npc);
    return;
  }
  if (npc.phase === "leave") {
    const order = world.orders.find((item) => item.requestId === npc.requestId);
    if (order && order.status !== "cancelled" && order.status !== "completed") order.status = "completed";
    npc.phase = "idle";
    npc.service = "";
    npc.x = npc.homeX;
    npc.z = npc.homeZ;
    npc.requestId = "";
    npc.paused = false;
    npc.cursor = 0;
  }
}

function placeProp(world: ServiceWorld, npc: NpcSim) {
  if (npc.service === "dance" || npc.service === "clear" || !npc.service) return;
  if (npc.service === "beer") {
    world.props = world.props.filter((prop) => prop.kind !== "beer");
    world.props.push({
      id: `crate-${npc.requestId}`,
      kind: "beer",
      x: LOUNGE_TABLE.x,
      z: LOUNGE_TABLE.z,
      remaining: DRINK.crateCans,
      ownerId: npc.ownerId,
      status: "full",
      tableId: "lounge",
    });
    return;
  }
  const slot = TABLE_SLOTS.find((point) => world.props.every((prop) => Math.hypot(prop.x - point.x, prop.z - point.z) > 0.12));
  if (!slot) return;
  const drinks = world.props.filter((prop) => prop.kind !== "beer" && prop.kind !== "can").length;
  if (drinks >= MAX_PROPS) return;
  world.props.push({
    id: `prop-${npc.requestId}`,
    kind: npc.service,
    x: slot.x,
    z: slot.z,
    remaining: 0,
    ownerId: npc.ownerId,
    status: "served",
    tableId: "lounge",
  });
}
