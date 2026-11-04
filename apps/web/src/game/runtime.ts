import type { Mesh } from "three";
import type { MotionId } from "@karaoke/shared";

export const stageRefs: { screen: Mesh | null } = { screen: null };

export const screenFrame = {
  visible: false,
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  clip: "none",
  transform: "none",
};

export const joystick = { x: 0, y: 0 };
export const actions = { run: false, jump: false, interact: false };
/** Pointers that belong to the joystick or action buttons, so a second finger can still orbit. */
export const uiPointers = new Set<number>();
export const voiceHud = { mic: false, deaf: false, status: "Chưa bật micro", speakers: "" };
export const cameraRig = { yaw: Math.PI, pitch: 0.32, distance: 4.4, mode: "follow" as "follow" | "stage" };
export const interactHud = { label: "" };

export const localMotion = {
  ready: false,
  x: 0,
  y: 0,
  z: -1.4,
  rot: Math.PI,
  vy: 0,
  seated: false,
  seatId: "",
  motion: "idle" as MotionId,
  singing: false,
  emote: "",
  emoteUntil: 0,
  outfit: "hoodie",
  color: "#c084fc",
  gender: "",
  skinColor: "",
  hairColor: "",
  avatarModel: "",
  stoodUntil: 0,
  jumpHeld: false,
  hand: "",
  handUntil: 0,
  drunk: 0,
  cansDrunk: 0,
  action: "",
  actionUntil: 0,
  hp: 100,
  hpState: "normal",
  combatUntil: 0,
  weapon: "",
};

export const roomFlags = { pvp: true, weaponStock: 4 };

export interface RemoteBody {
  id: string;
  name: string;
  color: string;
  outfit: string;
  gender: string;
  skinColor: string;
  hairColor: string;
  avatarModel: string;
  x: number;
  y: number;
  z: number;
  rot: number;
  seated: boolean;
  seatId: string;
  singing: boolean;
  motion: string;
  emote: string;
  emoteUntil: number;
  hand: string;
  drunk: number;
  hp: number;
  hpState: string;
  weapon: string;
}

export const remoteBodies = new Map<string, RemoteBody>();
export const remoteRoster = { ids: [] as string[], signature: "" };

export interface NpcBody {
  id: string;
  role: string;
  service: string;
  phase: string;
  label: string;
  x: number;
  z: number;
  rot: number;
  ownerId: string;
  spot: string;
  style: string;
  paused: boolean;
}

export interface PropBody {
  id: string;
  kind: string;
  x: number;
  z: number;
  remaining: number;
  ownerId: string;
  status: string;
}

export interface OrderBody {
  id: string;
  playerId: string;
  service: string;
  status: string;
  spot: string;
  style: string;
}

export const npcBodies = new Map<string, NpcBody>();
export const propBodies = new Map<string, PropBody>();
export const serviceRoster = {
  npcIds: [] as string[],
  propIds: [] as string[],
  orders: [] as OrderBody[],
  signature: "",
};
