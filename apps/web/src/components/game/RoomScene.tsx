"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { Vector3, type Group, type MeshStandardMaterial } from "three";
import {
  GRAVITY,
  JUMP_SPEED,
  LOUNGE_TABLE,
  SEATS,
  SOFA_RUNS,
  cameraBasis,
  cameraPull,
  facingYaw,
  resolvePlayerMove,
  type SeatSpot,
  type SofaRun,
} from "@karaoke/shared";
import { drunkVisual } from "@karaoke/shared";
import { sendCombat } from "@/game/combat-client";
import { fxSettings } from "@/game/fx-settings";
import { performInteract, refreshInteract, seatOccupied } from "@/game/interact";
import { screenMatrix } from "@/game/screen-fit";
import { actions, cameraRig, joystick, localMotion, npcBodies, propBodies, remoteBodies, remoteRoster, roomFlags, screenFrame, serviceRoster, stageRefs, uiPointers } from "@/game/runtime";
import { requestId } from "@/lib/time";
import { useSession } from "@/stores/session.store";
import { useTv } from "@/stores/tv.store";
import { Avatar } from "./Avatar";
import { KaraokeLights } from "./KaraokeLights";
import { KaraokeTV } from "./KaraokeTV";

const keys = new Set<string>();

function typingTarget(target: EventTarget | null) {
  const node = target as HTMLElement | null;
  const tag = node?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node?.isContentEditable;
}

export function RoomScene() {
  return (
    <>
      <color attach="background" args={["#090814"]} />
      <fog attach="fog" args={["#120c22", 11, 24]} />
      <KaraokeLights />
      <Scenery />
      <KaraokeTV />
      <LocalAvatar />
      <RemotePlayers />
      <ServiceActors />
      <ScreenProjector />
      <CameraRig />
    </>
  );
}

function Scenery() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[22, 20]} />
        <meshStandardMaterial color="#171228" />
      </mesh>
      <mesh position={[0, 0.015, -4.7]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.4, 1.6]} />
        <meshStandardMaterial color="#2a1844" emissive="#7c3aed" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 1.7, -7.2]}>
        <boxGeometry args={[22, 3.6, 0.25]} />
        <meshStandardMaterial color="#120e1e" />
      </mesh>
      <mesh position={[-10.2, 1.7, 0.6]}>
        <boxGeometry args={[0.25, 3.6, 17.4]} />
        <meshStandardMaterial color="#100e1c" />
      </mesh>
      <mesh position={[10.2, 1.7, 0.6]}>
        <boxGeometry args={[0.25, 3.6, 17.4]} />
        <meshStandardMaterial color="#100e1c" />
      </mesh>
      <mesh position={[0, 1.7, 8.6]}>
        <boxGeometry args={[22, 3.6, 0.25]} />
        <meshStandardMaterial color="#141022" />
      </mesh>
      <mesh position={[0, 1.15, 8.42]}>
        <boxGeometry args={[1.6, 2.1, 0.08]} />
        <meshStandardMaterial color="#3b2760" emissive="#22d3ee" emissiveIntensity={0.25} />
      </mesh>
      <Lounge />
      <Speaker position={[-5.2, 0, -5.2]} />
      <Speaker position={[5.2, 0, -5.2]} />
      <group position={[0, 0, -4.7]}>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 1.1, 8]} />
          <meshStandardMaterial color="#d6d3e0" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.15, 0.05]}>
          <sphereGeometry args={[0.08, 10, 10]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      </group>
      <WeaponRack />
      <group position={[6.55, 0, 6.15]}>
        <mesh position={[0, 0.48, 0]}>
          <boxGeometry args={[1.3, 0.96, 0.46]} />
          <meshStandardMaterial color="#2a2144" />
        </mesh>
        <mesh position={[0, 0.98, 0]}>
          <boxGeometry args={[1.36, 0.06, 0.52]} />
          <meshStandardMaterial color="#3a2458" />
        </mesh>
      </group>
      <mesh position={[-6.3, 0.72, 6.4]}>
        <boxGeometry args={[0.7, 0.08, 0.4]} />
        <meshStandardMaterial color="#1b1328" emissive="#c084fc" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 1.3, 8.15]}>
        <boxGeometry args={[1.3, 2.2, 0.08]} />
        <meshStandardMaterial color="#2a2140" />
      </mesh>
    </group>
  );
}

function WeaponRack() {
  const [stock, setStock] = useState(4);
  useEffect(() => {
    const timer = window.setInterval(() => setStock(roomFlags.weaponStock), 300);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <group position={[-8.4, 0, 6.5]}>
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[0.92, 1.44, 0.4]} />
        <meshStandardMaterial color="#4a3420" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.78, 0.16]}>
        <boxGeometry args={[0.7, 1.05, 0.04]} />
        <meshStandardMaterial color="#d6b07a" transparent opacity={0.28} roughness={0.15} />
      </mesh>
      {Array.from({ length: Math.max(0, Math.min(4, stock)) }, (_, index) => (
        <mesh key={index} position={[-0.24 + index * 0.16, 0.85, 0]} rotation={[0.08, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.025, 0.85, 6]} />
          <meshStandardMaterial color="#e6c48a" roughness={0.65} />
        </mesh>
      ))}
    </group>
  );
}

function Lounge() {
  return (
    <group>
      {SOFA_RUNS.map((run) => (
        <SofaModule key={run.id} run={run} />
      ))}
      <group position={[LOUNGE_TABLE.x, 0, LOUNGE_TABLE.z]}>
        <mesh position={[0, 0.46, 0]}>
          <boxGeometry args={[LOUNGE_TABLE.halfX * 2, 0.08, LOUNGE_TABLE.halfZ * 2]} />
          <meshStandardMaterial color="#241833" />
        </mesh>
        {[[-0.38, -0.2], [0.38, -0.2], [-0.38, 0.2], [0.38, 0.2]].map(([x, z]) => (
          <mesh key={`${x}:${z}`} position={[x, 0.2, z]}>
            <boxGeometry args={[0.06, 0.4, 0.06]} />
            <meshStandardMaterial color="#1a1228" />
          </mesh>
        ))}
        <mesh position={[0, 0.51, 0]}>
          <boxGeometry args={[LOUNGE_TABLE.halfX * 1.4, 0.02, 0.08]} />
          <meshStandardMaterial color="#111" emissive="#22d3ee" emissiveIntensity={0.45} />
        </mesh>
      </group>
      {SEATS.map((seat) => (
        <SeatMarker key={seat.id} seat={seat} />
      ))}
    </group>
  );
}

function SofaModule({ run }: { run: SofaRun }) {
  const half = run.length / 2;
  return (
    <group position={[run.x, 0, run.z]} rotation={[0, run.yaw, 0]}>
      <mesh position={[0, 0.48, -0.31]}>
        <boxGeometry args={[run.length, 0.46, 0.18]} />
        <meshStandardMaterial color="#4c3480" />
      </mesh>
      <mesh position={[0, 0.22, 0.04]}>
        <boxGeometry args={[run.length - 0.16, 0.28, 0.46]} />
        <meshStandardMaterial color="#3a2a5c" />
      </mesh>
      <mesh position={[-(half - 0.1), 0.34, 0.02]}>
        <boxGeometry args={[0.16, 0.28, 0.42]} />
        <meshStandardMaterial color="#2a1d44" />
      </mesh>
      <mesh position={[half - 0.1, 0.34, 0.02]}>
        <boxGeometry args={[0.16, 0.28, 0.42]} />
        <meshStandardMaterial color="#2a1d44" />
      </mesh>
      <mesh position={[0, 0.08, -0.34]}>
        <boxGeometry args={[run.length, 0.05, 0.06]} />
        <meshStandardMaterial color="#111" emissive="#c084fc" emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
}

function SeatMarker({ seat }: { seat: SeatSpot }) {
  const pip = useRef<MeshStandardMaterial>(null);
  useFrame(() => {
    const occupied = seatOccupied(seat.id);
    if (pip.current) {
      pip.current.emissive.set(occupied ? "#fb7185" : "#22d3ee");
      pip.current.emissiveIntensity = occupied ? 0.9 : 0.4;
    }
  });
  return (
    <group position={[seat.x, 0, seat.z]} rotation={[0, seat.rot, 0]}>
      <mesh
        position={[0, 0.36, -0.08]}
        onClick={(event) => {
          event.stopPropagation();
          if (localMotion.seated) {
            if (localMotion.seatId === seat.id) performInteract();
            return;
          }
          if (seatOccupied(seat.id)) return;
          if (Math.hypot(localMotion.x - seat.x, localMotion.z - seat.z) > 1.15) return;
          localMotion.x = seat.x;
          localMotion.z = seat.z;
          localMotion.rot = seat.rot;
          performInteract();
        }}
      >
        <boxGeometry args={[0.46, 0.05, 0.22]} />
        <meshStandardMaterial ref={pip} color="#1b1430" emissive="#22d3ee" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function Speaker({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.55, 1.1, 0.45]} />
        <meshStandardMaterial color="#161222" />
      </mesh>
      <mesh position={[0, 0.75, 0.18]}>
        <cylinderGeometry args={[0.14, 0.14, 0.06, 12]} />
        <meshStandardMaterial color="#2a2438" />
      </mesh>
    </group>
  );
}

function LocalAvatar() {
  const ref = useRef<Group>(null);
  const user = useSession((state) => state.user);
  const sent = useRef(0);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (typingTarget(event.target)) return;
      keys.add(event.key.toLowerCase());
      if (event.code === "Space") event.preventDefault();
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === "e") performInteract();
      if (key === "f") sendCombat("swing");
      if (key === "v") sendCombat("dodge");
    };
    const up = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((_, delta) => {
    if (!localMotion.ready) return;
    const locked = localMotion.hpState === "knocked_out" || localMotion.hpState === "recovering" || localMotion.combatUntil > Date.now();
    if (locked) {
      if (ref.current) {
        ref.current.position.set(localMotion.x, localMotion.y, localMotion.z);
        ref.current.rotation.y = localMotion.rot;
      }
      const now = performance.now();
      if (now - sent.current > 100) {
        sent.current = now;
        useTv.getState().send("player:move", {
          x: localMotion.x,
          y: localMotion.y,
          z: localMotion.z,
          rot: localMotion.rot,
          motion: localMotion.motion,
          singing: false,
        });
      }
      return;
    }
    const dt = Math.min(delta, 0.05);
    const running = keys.has("shift") || actions.run;
    if (!localMotion.seated) {
      const forwardInput = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - joystick.y;
      const strafeInput = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0) + joystick.x;
      const basis = cameraBasis(cameraRig.yaw);
      let dx = basis.forwardX * forwardInput + basis.rightX * strafeInput;
      let dz = basis.forwardZ * forwardInput + basis.rightZ * strafeInput;
      const length = Math.hypot(dx, dz);
      if (length > 0) {
        dx /= length;
        dz /= length;
        const speed = running ? 5.1 : 2.7;
        const others = [...remoteBodies.values()].map((body) => ({ x: body.x, z: body.z }));
        const next = resolvePlayerMove(
          localMotion,
          { x: localMotion.x + dx * speed * dt, z: localMotion.z + dz * speed * dt },
          dt,
          running,
          others,
        );
        localMotion.x = next.x;
        localMotion.z = next.z;
        const target = facingYaw(dx, dz);
        let turn = target - localMotion.rot;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        localMotion.rot += turn * Math.min(1, dt * 10);
        localMotion.singing = false;
      }
      const jump = keys.has(" ") || actions.jump;
      if (jump && !localMotion.jumpHeld && localMotion.y <= 0.001) localMotion.vy = JUMP_SPEED;
      localMotion.jumpHeld = jump;
      actions.jump = false;
      localMotion.vy -= GRAVITY * dt;
      localMotion.y = Math.max(0, localMotion.y + localMotion.vy * dt);
      if (localMotion.y === 0) localMotion.vy = 0;
      const moving = length > 0.05;
      if (localMotion.y > 0.08) localMotion.motion = "jump";
      else if (performance.now() < localMotion.stoodUntil) localMotion.motion = "stand";
      else if (moving && running) localMotion.motion = "run";
      else if (moving) localMotion.motion = "walk";
      else if (localMotion.emoteUntil > Date.now() && (localMotion.emote === "wave" || localMotion.emote === "clap" || localMotion.emote === "dance")) {
        localMotion.motion = localMotion.emote as "wave";
      } else if (localMotion.singing) localMotion.motion = "sing";
      else localMotion.motion = "idle";
    } else {
      localMotion.y = 0;
      localMotion.motion = "sit";
    }
    if (actions.interact) {
      actions.interact = false;
      performInteract();
    }
    refreshInteract();
    if (ref.current) {
      ref.current.position.set(localMotion.x, localMotion.y, localMotion.z);
      ref.current.rotation.y = localMotion.rot;
    }
    const now = performance.now();
    if (now - sent.current > 100) {
      sent.current = now;
      useTv.getState().send("player:move", {
        x: localMotion.x,
        y: localMotion.y,
        z: localMotion.z,
        rot: localMotion.rot,
        motion: localMotion.motion,
        singing: localMotion.singing,
      });
    }
  });

  return (
    <group ref={ref}>
      <Avatar
        sample={() => ({
          motion: localMotion.motion,
          emote: localMotion.emote,
          emoteUntil: localMotion.emoteUntil,
          singing: localMotion.singing,
          color: localMotion.color,
          outfit: localMotion.outfit,
          gender: localMotion.gender,
          skinColor: localMotion.skinColor,
          hairColor: localMotion.hairColor,
          avatarModel: localMotion.avatarModel,
          hand: localMotion.hand,
          drunk: localMotion.drunk,
          hp: localMotion.hp,
          weapon: localMotion.weapon,
          action: localMotion.action,
          actionUntil: localMotion.actionUntil,
          name: user?.displayName ?? "Bạn",
        })}
      />
    </group>
  );
}

function ServiceActors() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const sync = () => setTick((value) => value + 1);
    window.addEventListener("karaoke-service", sync);
    return () => window.removeEventListener("karaoke-service", sync);
  }, []);
  void tick;
  return (
    <>
      {serviceRoster.npcIds.map((id) => (
        <NpcActor key={id} id={id} />
      ))}
      {serviceRoster.propIds.map((id) => {
        const prop = propBodies.get(id);
        if (!prop) return null;
        if (prop.kind === "beer") return <BeerCrate key={id} id={id} />;
        if (prop.kind === "can") {
          return (
            <mesh key={id} position={[prop.x, 0.64, prop.z]}>
              <cylinderGeometry args={[0.035, 0.035, 0.12, 8]} />
              <meshStandardMaterial color={prop.status === "empty" ? "#94a3b8" : "#f5d76e"} metalness={0.35} />
            </mesh>
          );
        }
        const color = prop.kind === "juice" ? "#fb7185" : prop.kind === "water" ? "#bae6fd" : prop.kind === "soda" ? "#67e8f9" : prop.kind === "fruit" ? "#facc15" : "#f97316";
        return (
          <mesh key={id} position={[prop.x, 0.58, prop.z]}>
            <cylinderGeometry args={[0.07, 0.08, prop.kind === "fruit" || prop.kind === "snack" ? 0.08 : 0.16, 10]} />
            <meshStandardMaterial color={color} />
          </mesh>
        );
      })}
    </>
  );
}

function BeerCrate({ id }: { id: string }) {
  const prop = propBodies.get(id);
  if (!prop) return null;
  const cans = [];
  for (let i = 0; i < 24; i += 1) {
    if (i >= prop.remaining) continue;
    const col = i % 6;
    const row = Math.floor(i / 6);
    cans.push(
      <mesh key={i} position={[(col - 2.5) * 0.07, 0.1, (row - 1.5) * 0.07]}>
        <cylinderGeometry args={[0.028, 0.028, 0.09, 6]} />
        <meshStandardMaterial color="#f5d76e" metalness={0.4} roughness={0.4} />
      </mesh>,
    );
  }
  return (
    <group position={[prop.x, 0.56, prop.z]}>
      <mesh>
        <boxGeometry args={[0.5, 0.12, 0.36]} />
        <meshStandardMaterial color={prop.status === "empty" ? "#6b5a3e" : "#d6a84f"} />
      </mesh>
      {cans}
    </group>
  );
}

function NpcActor({ id }: { id: string }) {
  const ref = useRef<Group>(null);
  const shown = useRef({ x: 0, z: 3.8, rot: Math.PI });
  useFrame((_, delta) => {
    const body = npcBodies.get(id);
    const group = ref.current;
    if (!body || !group) return;
    const blend = Math.min(1, delta * 8);
    shown.current.x += (body.x - shown.current.x) * blend;
    shown.current.z += (body.z - shown.current.z) * blend;
    let turn = body.rot - shown.current.rot;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    shown.current.rot += turn * blend;
    group.position.set(shown.current.x, 0, shown.current.z);
    group.rotation.y = shown.current.rot;
  });
  const carrying = npcBodies.get(id)?.service === "beer" && npcBodies.get(id)?.phase === "walk";
  return (
    <group ref={ref}>
      {carrying ? (
        <mesh position={[0, 0.85, 0.28]}>
          <boxGeometry args={[0.28, 0.16, 0.2]} />
          <meshStandardMaterial color="#d6a84f" />
        </mesh>
      ) : null}
      <Avatar
        sample={() => {
          const body = npcBodies.get(id);
          const dancer = body?.role === "dancer";
          const motion = body?.phase === "greet" ? "wave" : body?.paused ? "idle" : body?.phase === "work" && dancer ? "dance" : body?.phase === "idle" || body?.phase === "work" ? "idle" : "walk";
          return {
            motion,
            emote: "",
            emoteUntil: 0,
            singing: false,
            color: dancer ? "#f472b6" : "#67e8f9",
            outfit: "vest",
            gender: dancer ? "female" : "male",
            skinColor: dancer ? "#f6d7c3" : "#e0ac69",
            hairColor: "#1a1024",
            avatarModel: dancer ? "long" : "short",
            danceStyle: body?.style || "loop1",
            name: body?.label ?? "NPC",
          };
        }}
      />
    </group>
  );
}

function RemotePlayers() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setIds([...remoteRoster.ids]);
    sync();
    window.addEventListener("karaoke-remotes", sync);
    return () => window.removeEventListener("karaoke-remotes", sync);
  }, []);
  return (
    <>
      {ids.map((id) => (
        <RemoteAvatar key={id} id={id} />
      ))}
    </>
  );
}

function RemoteAvatar({ id }: { id: string }) {
  const ref = useRef<Group>(null);
  const shown = useRef({ x: 0, z: 3, rot: 0 });
  useFrame((_, delta) => {
    const body = remoteBodies.get(id);
    const group = ref.current;
    if (!body || !group) return;
    const blend = Math.min(1, delta * 8);
    shown.current.x += (body.x - shown.current.x) * blend;
    shown.current.z += (body.z - shown.current.z) * blend;
    let rotDelta = body.rot - shown.current.rot;
    while (rotDelta > Math.PI) rotDelta -= Math.PI * 2;
    while (rotDelta < -Math.PI) rotDelta += Math.PI * 2;
    shown.current.rot += rotDelta * blend;
    group.position.set(shown.current.x, body.y, shown.current.z);
    group.rotation.y = shown.current.rot;
  });
  return (
    <group ref={ref}>
      <Avatar
        sample={() => {
          const body = remoteBodies.get(id);
          return {
            motion: body?.motion || (body?.seated ? "sit" : "idle"),
            emote: body?.emote ?? "",
            emoteUntil: body?.emoteUntil ?? 0,
            singing: body?.singing ?? false,
            color: body?.color ?? "#67e8f9",
            outfit: body?.outfit ?? "hoodie",
            gender: body?.gender ?? "",
            skinColor: body?.skinColor ?? "",
            hairColor: body?.hairColor ?? "",
            avatarModel: body?.avatarModel ?? "",
            hand: body?.hand ?? "",
            drunk: body?.drunk ?? 0,
            hp: body?.hp ?? 100,
            weapon: body?.weapon ?? "",
            name: body?.name ?? "Khách",
          };
        }}
      />
    </group>
  );
}

const screenCorners = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
const screenNormal = new Vector3();
const screenCenter = new Vector3();
const cameraOffset = new Vector3();
const cameraTarget = new Vector3();
const followWanted = new Vector3();

function ScreenProjector() {
  const { camera, size } = useThree();
  useFrame(() => {
    const mesh = stageRefs.screen;
    if (!mesh) {
      screenFrame.visible = false;
      return;
    }
    const params = (mesh.geometry as { parameters?: { width: number; height: number } }).parameters;
    const halfW = (params?.width ?? 3.28) / 2;
    const halfH = (params?.height ?? 1.8) / 2;
    const locals = [
      [-halfW, halfH, 0],
      [halfW, halfH, 0],
      [halfW, -halfH, 0],
      [-halfW, -halfH, 0],
    ] as const;
    mesh.updateWorldMatrix(true, false);
    screenNormal.set(0, 0, 1).transformDirection(mesh.matrixWorld);
    mesh.getWorldPosition(screenCenter);
    cameraOffset.copy(camera.position).sub(screenCenter).normalize();
    const facing = screenNormal.dot(cameraOffset) > 0.2;
    const points = locals.map(([x, y, z], index) => {
      const projected = screenCorners[index].set(x, y, z).applyMatrix4(mesh.matrixWorld).project(camera);
      return {
        x: (projected.x * 0.5 + 0.5) * size.width,
        y: (-projected.y * 0.5 + 0.5) * size.height,
        z: projected.z,
      };
    });
    const left = Math.min(...points.map((point) => point.x));
    const top = Math.min(...points.map((point) => point.y));
    const right = Math.max(...points.map((point) => point.x));
    const bottom = Math.max(...points.map((point) => point.y));
    const width = right - left;
    const height = bottom - top;
    const onScreen = points.every((point) => point.z < 1 && point.z > -1);
    if (!facing || !onScreen || width < 40 || height < 30) {
      screenFrame.visible = false;
      screenFrame.transform = "none";
      return;
    }
    screenFrame.visible = true;
    screenFrame.left = 0;
    screenFrame.top = 0;
    screenFrame.width = width;
    screenFrame.height = height;
    screenFrame.clip = "none";
    screenFrame.transform = screenMatrix(width, height, points);
  });
  return null;
}

function pointerSpan(points: Map<number, { x: number; y: number }>) {
  const [a, b] = [...points.values()];
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function CameraRig() {
  const { camera, gl } = useThree();
  const drag = useRef<number | null>(null);
  const last = useRef({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.style.touchAction = "none";
    const down = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType !== "touch") return;
      if (uiPointers.has(event.pointerId)) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.current.size === 1) {
        drag.current = event.pointerId;
        last.current = { x: event.clientX, y: event.clientY };
        return;
      }
      drag.current = null;
      pinch.current = pointerSpan(pointers.current);
    };
    const move = (event: PointerEvent) => {
      if (!pointers.current.has(event.pointerId) || uiPointers.has(event.pointerId)) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.current.size >= 2) {
        const next = pointerSpan(pointers.current);
        const delta = pinch.current - next;
        pinch.current = next;
        cameraRig.distance = Math.max(2.2, Math.min(9, cameraRig.distance + delta * 0.012));
        return;
      }
      if (drag.current !== event.pointerId) return;
      const dx = event.clientX - last.current.x;
      const dy = event.clientY - last.current.y;
      last.current = { x: event.clientX, y: event.clientY };
      const touch = event.pointerType === "touch";
      cameraRig.yaw -= dx * (touch ? 0.008 : 0.005);
      cameraRig.pitch = Math.max(0.12, Math.min(1.05, cameraRig.pitch + dy * (touch ? 0.006 : 0.004)));
    };
    const up = (event: PointerEvent) => {
      pointers.current.delete(event.pointerId);
      if (drag.current === event.pointerId) drag.current = null;
      if (pointers.current.size === 1) {
        const [id, point] = [...pointers.current.entries()][0];
        drag.current = id;
        last.current = point;
        pinch.current = 0;
      } else if (pointers.current.size >= 2) {
        pinch.current = pointerSpan(pointers.current);
      } else {
        pinch.current = 0;
      }
    };
    const wheel = (event: WheelEvent) => {
      cameraRig.distance = Math.max(2.2, Math.min(9, cameraRig.distance + event.deltaY * 0.004));
    };
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: true });
    return () => {
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
    };
  }, [gl]);

  const offset = useRef(new Vector3());
  const offsetReady = useRef(false);

  useFrame((_, delta) => {
    if (cameraRig.mode === "stage") {
      cameraTarget.set(0, 2.8, 0.6);
      camera.position.lerp(cameraTarget, 1 - Math.exp(-8 * delta));
      camera.lookAt(0, 1.5, -6.2);
      const stageSway = cameraDrunk();
      if (stageSway.roll > 0.0001) camera.rotateZ(Math.sin(performance.now() / 1000 * 1.7) * stageSway.roll * 0.45);
      offsetReady.current = false;
      return;
    }
    const basis = cameraBasis(cameraRig.yaw);
    const flat = Math.cos(cameraRig.pitch);
    const desiredX = localMotion.x - basis.forwardX * cameraRig.distance * flat;
    const desiredZ = localMotion.z - basis.forwardZ * cameraRig.distance * flat;
    const pulled = cameraPull(localMotion.x, localMotion.z, desiredX, desiredZ);
    const wanted = followWanted.set(
      pulled.x - localMotion.x,
      1.35 + Math.sin(cameraRig.pitch) * cameraRig.distance - 1.05,
      pulled.z - localMotion.z,
    );
    if (!offsetReady.current) {
      offset.current.copy(wanted);
      offsetReady.current = true;
    } else {
      offset.current.lerp(wanted, 1 - Math.exp(-14 * delta));
    }
    if (Math.hypot(offset.current.x, offset.current.z) < 1.45) {
      offset.current.y = Math.max(offset.current.y, 2.15);
    }
    camera.position.set(
      localMotion.x + offset.current.x,
      localMotion.y + 1.05 + offset.current.y,
      localMotion.z + offset.current.z,
    );
    const sway = cameraDrunk();
    if (sway.sway > 0.0001) {
      const time = performance.now() / 1000;
      camera.position.x += Math.sin(time * 1.3) * sway.sway * 8;
      camera.position.y += Math.cos(time * 1.1) * sway.sway * 4;
    }
    camera.lookAt(localMotion.x, localMotion.y + 1.05, localMotion.z);
    if (sway.roll > 0.0001) camera.rotateZ(Math.sin(performance.now() / 1000 * 1.7) * sway.roll);
  });
  return null;
}

function cameraDrunk() {
  const knocked = localMotion.hpState === "knocked_out";
  const level = localMotion.drunk * (knocked ? 0.2 : 1);
  const sway = drunkVisual(level);
  if (!fxSettings.reduceCamera && !fxSettings.reduceMotion) return sway;
  const scale = (fxSettings.reduceCamera ? 0.15 : 1) * (fxSettings.reduceMotion ? 0.4 : 1);
  return { ...sway, roll: sway.roll * scale, sway: sway.sway * scale };
}

export function sendEmote(emote: string) {
  useTv.getState().send("player:emote", { emote, requestId: requestId() });
  localMotion.emote = emote;
  localMotion.emoteUntil = Date.now() + 2600;
  if (emote === "wave" || emote === "clap" || emote === "dance") localMotion.motion = emote as "wave";
}
