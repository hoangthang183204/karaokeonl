"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, MeshStandardMaterial } from "three";

export interface AvatarSample {
  motion: string;
  emote: string;
  emoteUntil: number;
  singing: boolean;
  color: string;
  outfit: string;
  name: string;
  gender?: string;
  skinColor?: string;
  hairColor?: string;
  avatarModel?: string;
  hand?: string;
  drunk?: number;
  danceStyle?: string;
  action?: string;
  actionUntil?: number;
}

export function Avatar({ sample, preview = false }: { sample: () => AvatarSample; preview?: boolean }) {
  const body = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const head = useRef<Group>(null);
  const hips = useRef<Group>(null);
  const hairShort = useRef<Group>(null);
  const hairLong = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const cloth = useRef<MeshStandardMaterial>(null);
  const pants = useRef<MeshStandardMaterial>(null);
  const pantsRight = useRef<MeshStandardMaterial>(null);
  const skin = useRef<MeshStandardMaterial>(null);
  const skinLeft = useRef<MeshStandardMaterial>(null);
  const skinRight = useRef<MeshStandardMaterial>(null);
  const hair = useRef<MeshStandardMaterial>(null);
  const hairLeft = useRef<MeshStandardMaterial>(null);
  const hairRight = useRef<MeshStandardMaterial>(null);
  const hairSide = useRef<MeshStandardMaterial>(null);
  const hipCloth = useRef<MeshStandardMaterial>(null);
  const vest = useRef<Group>(null);
  const can = useRef<Group>(null);
  const name = useRef<HTMLDivElement>(null);

  useFrame(({ clock }) => {
    const pose = sample();
    const now = Date.now();
    const emote = pose.emoteUntil > now ? pose.emote : "";
    const shownEmote = emote === "cheer" ? "clap" : emote;
    const acting = pose.action && (pose.actionUntil ?? 0) > now ? pose.action : "";
    const motion = pose.singing && pose.motion === "idle" ? "sing" : shownEmote === "wave" || shownEmote === "clap" || shownEmote === "dance" ? shownEmote : pose.motion;
    const t = clock.elapsedTime;
    const drunk = Math.max(0, Math.min(10, pose.drunk ?? 0));
    const tipsy = drunk >= 1;
    const danceRate = pose.danceStyle === "loop3" ? 4.2 : pose.danceStyle === "loop2" ? 8.5 : 6;
    const walk = motion === "walk" || motion === "run";
    const speed = motion === "run" ? 12 : 7;
    const swing = walk ? Math.sin(t * speed) * (motion === "run" ? 0.7 : 0.45) : 0;
    const sway = tipsy ? Math.sin(t * (1.4 + Math.min(drunk, 7) * 0.25)) * (0.04 + Math.min(drunk, 7) * 0.025) : 0;
    const styled = pose.gender === "male" || pose.gender === "female";
    const female = pose.gender === "female";
    if (cloth.current) cloth.current.color.set(pose.color || "#c084fc");
    const legColor = styled ? pose.color || "#1e1b2e" : "#1e1b2e";
    if (pants.current) pants.current.color.set(legColor);
    if (pantsRight.current) pantsRight.current.color.set(legColor);
    const skinColor = styled ? pose.skinColor || "#f6ecff" : "#f6ecff";
    if (skin.current) skin.current.color.set(skinColor);
    if (skinLeft.current) skinLeft.current.color.set(skinColor);
    if (skinRight.current) skinRight.current.color.set(skinColor);
    const hairColor = pose.hairColor || "#1a1024";
    if (hair.current) hair.current.color.set(hairColor);
    if (hairLeft.current) hairLeft.current.color.set(hairColor);
    if (hairRight.current) hairRight.current.color.set(hairColor);
    if (hairSide.current) hairSide.current.color.set(hairColor);
    if (hipCloth.current) hipCloth.current.color.set(pose.color || "#f472b6");
    if (torso.current) torso.current.scale.set(styled ? (female ? 0.84 : 1.16) : 1, styled ? (female ? 0.94 : 1.08) : 1, styled ? (female ? 0.9 : 1.04) : 1);
    if (head.current) head.current.scale.setScalar(styled ? (female ? 1.08 : 0.94) : 1);
    if (hips.current) hips.current.visible = female;
    if (hairShort.current) hairShort.current.visible = styled && pose.avatarModel !== "long";
    if (hairLong.current) hairLong.current.visible = styled && pose.avatarModel === "long";
    if (vest.current) vest.current.visible = pose.outfit === "vest";
    if (body.current) {
      const bob = motion === "sit" ? 0.42 : 0.78 + (motion === "jump" ? 0.05 : Math.sin(t * 2) * 0.015);
      body.current.position.y = acting === "pickup" ? bob - 0.12 : bob;
      const danceRoll = motion === "dance" ? Math.sin(t * danceRate) * (pose.danceStyle === "loop3" ? 0.22 : 0.12) : motion === "run" ? 0.08 : 0;
      body.current.rotation.z = danceRoll + sway;
      body.current.rotation.x = acting === "pickup" ? 0.45 : drunk >= 7 ? Math.sin(t * 1.2) * 0.08 : 0;
    }
    if (head.current) {
      head.current.rotation.z = pose.hand === "drinking" || acting === "drink" ? 0.28 : 0;
      head.current.rotation.x = acting === "pickup" ? 0.4 : 0;
    }
    if (legL.current && legR.current) {
      const sit = motion === "sit" ? 1.25 : 0;
      const wobble = tipsy && walk ? sway : 0;
      legL.current.rotation.x = sit || swing + wobble;
      legR.current.rotation.x = sit || -swing - wobble;
    }
    if (armL.current && armR.current) {
      const reach = styled ? (female ? 0.2 : 0.28) : 0.24;
      armL.current.position.x = -reach;
      armR.current.position.x = reach;
      const drinking = pose.hand === "drinking" || acting === "drink";
      const holding = pose.hand === "closed" || pose.hand === "open" || pose.hand === "empty" || pose.hand === "opening" || drinking;
      armL.current.rotation.x = motion === "clap" ? -0.8 + Math.sin(t * 10) * 0.25 : -swing;
      armR.current.rotation.x = drinking || acting === "open" ? -2.35 : holding ? -1.05 : motion === "wave" || motion === "sing" ? -2.2 + Math.sin(t * (motion === "wave" ? 8 : 3)) * 0.35 : acting === "pickup" ? 1.1 : swing;
      armL.current.rotation.z = motion === "dance" ? Math.sin(t * danceRate) * 0.6 : 0.15;
      armR.current.rotation.z = motion === "dance" ? -Math.sin(t * danceRate + (pose.danceStyle === "loop2" ? 1.2 : 0)) * 0.6 : holding ? -0.35 : -0.15;
      if (can.current) can.current.visible = Boolean(holding);
    }
    if (name.current && name.current.textContent !== pose.name) name.current.textContent = pose.name;
  });

  return (
    <group>
      <group ref={legL} position={[-0.1, 0.42, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow={preview}>
          <capsuleGeometry args={[0.07, 0.22, 4, 8]} />
          <meshStandardMaterial ref={pants} color="#1e1b2e" />
        </mesh>
      </group>
      <group ref={legR} position={[0.1, 0.42, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow={preview}>
          <capsuleGeometry args={[0.07, 0.22, 4, 8]} />
          <meshStandardMaterial ref={pantsRight} color="#1e1b2e" />
        </mesh>
      </group>
      <group ref={body}>
        <group ref={hips} visible={false} position={[0, -0.16, 0]}>
          <mesh castShadow={preview}>
            <boxGeometry args={[0.4, 0.16, 0.24]} />
            <meshStandardMaterial ref={hipCloth} color="#f472b6" />
          </mesh>
        </group>
        <group ref={torso}>
          <mesh castShadow={preview}>
            <boxGeometry args={[0.42, 0.46, 0.26]} />
            <meshStandardMaterial ref={cloth} color="#c084fc" />
          </mesh>
        </group>
        <group ref={vest} visible={false}>
          <mesh position={[0, 0.02, 0.1]} castShadow={preview}>
            <boxGeometry args={[0.3, 0.3, 0.05]} />
            <meshStandardMaterial color="#111018" />
          </mesh>
        </group>
        <group ref={head} position={[0, 0.42, 0]}>
          <mesh castShadow={preview}>
            <sphereGeometry args={[0.16, 14, 14]} />
            <meshStandardMaterial ref={skin} color="#f6ecff" />
          </mesh>
          <group ref={hairShort} visible={false} position={[0, 0.1, -0.03]}>
            <mesh castShadow={preview} scale={[1, 0.62, 1]}>
              <sphereGeometry args={[0.145, 12, 12]} />
              <meshStandardMaterial ref={hair} color="#1a1024" />
            </mesh>
          </group>
          <group ref={hairLong} visible={false}>
            <mesh position={[0, 0.08, -0.04]} castShadow={preview}>
              <sphereGeometry args={[0.155, 12, 12]} />
              <meshStandardMaterial ref={hairLeft} color="#1a1024" />
            </mesh>
            <mesh position={[-0.12, -0.08, -0.04]} castShadow={preview}>
              <capsuleGeometry args={[0.045, 0.22, 4, 8]} />
              <meshStandardMaterial ref={hairRight} color="#1a1024" />
            </mesh>
            <mesh position={[0.12, -0.08, -0.04]} castShadow={preview}>
              <capsuleGeometry args={[0.045, 0.22, 4, 8]} />
              <meshStandardMaterial ref={hairSide} color="#1a1024" />
            </mesh>
          </group>
          <mesh position={[-0.06, 0.04, 0.12]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color="#1a1024" />
          </mesh>
          <mesh position={[0.06, 0.04, 0.12]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color="#1a1024" />
          </mesh>
        </group>
      </group>
      <group ref={armL} position={[-0.24, 0.78, 0]}>
        <mesh position={[0, -0.16, 0]} castShadow={preview}>
          <capsuleGeometry args={[0.055, 0.18, 4, 8]} />
          <meshStandardMaterial ref={skinLeft} color="#f6ecff" />
        </mesh>
      </group>
      <group ref={armR} position={[0.24, 0.78, 0]}>
        <mesh position={[0, -0.16, 0]} castShadow={preview}>
          <capsuleGeometry args={[0.055, 0.18, 4, 8]} />
          <meshStandardMaterial ref={skinRight} color="#f6ecff" />
        </mesh>
        <group ref={can} visible={false} position={[0.02, -0.34, 0.04]}>
          <mesh>
            <cylinderGeometry args={[0.035, 0.035, 0.12, 8]} />
            <meshStandardMaterial color="#f5d76e" metalness={0.45} roughness={0.35} />
          </mesh>
        </group>
      </group>
      {preview ? null : (
        <Html center position={[0, 1.72, 0]} distanceFactor={8} zIndexRange={[4, 0]}>
          <div ref={name} className="whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-xs text-white" />
        </Html>
      )}
    </group>
  );
}
