"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshStandardMaterial } from "three";
import { stageRefs } from "@/game/runtime";

export function KaraokeTV() {
  const screen = useRef<Mesh>(null);
  const led = useRef<MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (screen.current) stageRefs.screen = screen.current;
    if (led.current) led.current.emissiveIntensity = 0.7 + Math.sin(clock.elapsedTime * 2.2) * 0.35;
  });

  return (
    <group position={[0, 1.72, -6.35]}>
      <mesh position={[0, -1.15, 0.05]}>
        <boxGeometry args={[0.16, 0.72, 0.16]} />
        <meshStandardMaterial color="#14141c" />
      </mesh>
      <mesh position={[0, -1.52, 0.05]}>
        <boxGeometry args={[0.9, 0.08, 0.42]} />
        <meshStandardMaterial color="#1c1c28" />
      </mesh>
      <mesh>
        <boxGeometry args={[3.55, 2.05, 0.12]} />
        <meshStandardMaterial color="#07070d" metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh ref={screen} position={[0, 0, 0.07]}>
        <planeGeometry args={[3.46, 1.98]} />
        <meshBasicMaterial color="#05060d" />
      </mesh>
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[3.68, 2.18, 0.05]} />
        <meshStandardMaterial ref={led} color="#2a103f" emissive="#d946ef" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}
