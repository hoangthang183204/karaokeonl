"use client";

import { lightSample } from "@karaoke/shared";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, HemisphereLight, MeshStandardMaterial, Object3D, PointLight, SpotLight } from "three";
import { Color } from "three";
import { npcBodies } from "@/game/runtime";
import { lightingLive } from "@/game/lighting-runtime";

const primary = new Color();
const secondary = new Color();

export function KaraokeLights() {
  const stripL = useRef<MeshStandardMaterial>(null);
  const stripR = useRef<MeshStandardMaterial>(null);
  const stripStage = useRef<MeshStandardMaterial>(null);
  const ceilingA = useRef<MeshStandardMaterial>(null);
  const ceilingB = useRef<MeshStandardMaterial>(null);
  const laserA = useRef<MeshStandardMaterial>(null);
  const laserB = useRef<MeshStandardMaterial>(null);
  const lasers = useRef<Group>(null);
  const washL = useRef<PointLight>(null);
  const washR = useRef<PointLight>(null);
  const spotL = useRef<SpotLight>(null);
  const spotR = useRef<SpotLight>(null);
  const aimL = useRef<Object3D>(null);
  const aimR = useRef<Object3D>(null);
  const hemi = useRef<HemisphereLight>(null);

  useFrame(() => {
    const settings = lightingLive;
    const lowMemory = typeof navigator !== "undefined" && (navigator as Navigator & { deviceMemory?: number }).deviceMemory !== undefined && ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 3;
    const reduced = settings.reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = lightSample(settings, Date.now(), reduced);
    const inactive = frame.mode === "static" && (!settings.enabled || settings.effectMode === "off" || settings.effectMode === "music-reactive");
    primary.set(frame.primary);
    secondary.set(frame.secondary);
    const level = inactive ? 0 : 0.8 + settings.brightness * 0.5;
    const left = frame.blink > 0.5 ? 1 : 0.06;
    const right = frame.blink > 0.5 ? 0.06 : 1;
    const beat = frame.blink > 0.5 ? 1 : 0.12;
    const paint = (material: MeshStandardMaterial | null, color: Color, scale: number) => {
      if (!material) return;
      material.color.copy(color);
      material.emissive.copy(color);
      material.emissiveIntensity = level * scale;
    };
    paint(stripL.current, primary, 2.8 * left);
    paint(stripR.current, secondary, 2.8 * right);
    paint(stripStage.current, primary, frame.floor * 1.8 * beat);
    paint(ceilingA.current, primary, 2.4 * left);
    paint(ceilingB.current, secondary, 2.4 * right);
    if (washL.current && washR.current) {
      washL.current.color.copy(primary);
      washR.current.color.copy(secondary);
      const wash = (frame.mode === "dance-show" ? 12 : 34) * level;
      washL.current.intensity = wash * left;
      washR.current.intensity = wash * right;
    }
    const dancer = [...npcBodies.values()].find((npc) => npc.role === "dancer" && (npc.phase === "work" || npc.phase === "greet" || npc.phase === "walk"));
    const follow = settings.spotTarget === "dancer" && dancer ? dancer : null;
    const aimX = follow ? follow.x : Math.sin(frame.spotYaw) * 1.3;
    const aimZ = follow ? follow.z : -4.7;
    if (aimL.current && aimR.current) {
      aimL.current.position.set(aimX - 0.4, 0.15, aimZ);
      aimR.current.position.set(aimX + 0.4, 0.15, aimZ);
    }
    if (spotL.current && spotR.current && aimL.current && aimR.current) {
      spotL.current.target = aimL.current;
      spotR.current.target = aimR.current;
      const spot = inactive || settings.spotlightIntensity <= 0 ? 0 : settings.spotlightIntensity * level * (frame.mode === "dance-show" ? 18 : 42);
      spotL.current.intensity = spot * frame.strobe * left;
      spotR.current.intensity = spot * frame.strobe * right;
      spotL.current.color.copy(primary);
      spotR.current.color.copy(secondary);
    }
    if (lasers.current) {
      lasers.current.visible = frame.lasers && !lowMemory;
      lasers.current.rotation.y = frame.spotYaw;
    }
    if (laserA.current && laserB.current) {
      laserA.current.color.copy(primary);
      laserA.current.emissive.copy(primary);
      laserA.current.emissiveIntensity = frame.lasers ? 2.4 * level * left : 0;
      laserB.current.color.copy(secondary);
      laserB.current.emissive.copy(secondary);
      laserB.current.emissiveIntensity = frame.lasers ? 2.4 * level * right : 0;
    }
    if (hemi.current) hemi.current.intensity = settings.ambientIntensity * (settings.enabled ? 0.9 + beat : 0.2);
  });

  return (
    <group>
      <hemisphereLight ref={hemi} args={["#d8c8ff", "#241428", 0.8]} />
      <pointLight ref={washL} position={[-3.2, 3.2, 1.2]} distance={18} intensity={40} />
      <pointLight ref={washR} position={[3.2, 3.2, 1.2]} distance={18} intensity={40} />
      <group position={[0, 3.6, -2.4]}>
        <spotLight ref={spotL} position={[-1.2, 0, 0]} angle={0.42} penumbra={0.75} distance={12} intensity={16} />
        <spotLight ref={spotR} position={[1.2, 0, 0]} angle={0.42} penumbra={0.75} distance={12} intensity={16} />
      </group>
      <object3D ref={aimL} position={[-0.8, 0.15, -4.7]} />
      <object3D ref={aimR} position={[0.8, 0.15, -4.7]} />
      <group ref={lasers} position={[0, 3.3, -3.2]} visible={false}>
        <mesh position={[-0.7, 0, 0]} rotation={[0.9, 0, 0.2]}>
          <boxGeometry args={[0.08, 0.08, 5.2]} />
          <meshStandardMaterial ref={laserA} color="#f472b6" emissive="#f472b6" emissiveIntensity={0} transparent opacity={0.8} />
        </mesh>
        <mesh position={[0.7, 0, 0]} rotation={[0.9, 0, -0.2]}>
          <boxGeometry args={[0.08, 0.08, 5.2]} />
          <meshStandardMaterial ref={laserB} color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0} transparent opacity={0.8} />
        </mesh>
      </group>
      <mesh position={[-4.2, 2.55, -6.4]}>
        <boxGeometry args={[3.4, 0.16, 0.22]} />
        <meshStandardMaterial ref={stripL} color="#c084fc" emissive="#c084fc" emissiveIntensity={2} />
      </mesh>
      <mesh position={[4.2, 2.55, -6.4]}>
        <boxGeometry args={[3.4, 0.16, 0.22]} />
        <meshStandardMaterial ref={stripR} color="#22d3ee" emissive="#22d3ee" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0, 0.04, -4.7]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.7, 2.35, 40]} />
        <meshStandardMaterial ref={stripStage} color="#c084fc" emissive="#c084fc" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[-2.6, 2.65, 0.4]}>
        <boxGeometry args={[2.8, 0.16, 0.28]} />
        <meshStandardMaterial ref={ceilingA} color="#c084fc" emissive="#c084fc" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[2.6, 2.65, 0.4]}>
        <boxGeometry args={[2.8, 0.16, 0.28]} />
        <meshStandardMaterial ref={ceilingB} color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.4} />
      </mesh>
    </group>
  );
}
