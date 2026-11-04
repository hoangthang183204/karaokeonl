"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  GENDERS,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_COLORS,
  LOOK_COLORS,
  OUTFITS,
  defaultAvatar,
  type AvatarConfig,
  type GenderId,
  type HairStyleId,
  type OutfitId,
} from "@karaoke/shared";
import { useState } from "react";
import { Avatar } from "../game/Avatar";

type Draft = Omit<AvatarConfig, "userId" | "isCreated">;

export function CharacterCreator({
  initial,
  saving,
  onSave,
}: {
  initial: Draft;
  saving: boolean;
  onSave: (draft: Draft) => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);

  const chooseGender = (gender: GenderId) => {
    const base = defaultAvatar(gender);
    setDraft((current) => ({
      ...current,
      gender,
      avatarModel: base.avatarModel,
    }));
  };

  const randomize = () => {
    const gender = GENDERS[Math.floor(Math.random() * GENDERS.length)];
    setDraft({
      gender,
      skinColor: SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)],
      hairColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)],
      outfitColor: LOOK_COLORS[Math.floor(Math.random() * LOOK_COLORS.length)],
      avatarModel: HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)],
      outfit: OUTFITS[Math.floor(Math.random() * OUTFITS.length)],
    });
  };

  return (
    <main className="grid h-[100dvh] grid-rows-[minmax(15rem,42dvh)_minmax(0,1fr)] bg-ink text-white lg:grid-cols-[1.15fr_0.85fr] lg:grid-rows-1">
      <div className="relative min-h-0">
        <Canvas shadows camera={{ position: [0, 1.35, 3.1], fov: 32 }} dpr={[1, 1.5]}>
          <color attach="background" args={["#14081f"]} />
          <ambientLight intensity={0.7} />
          <directionalLight
            position={[2.2, 4.2, 2.6]}
            intensity={1.4}
            castShadow
            shadow-mapSize-width={512}
            shadow-mapSize-height={512}
          />
          <Avatar
            preview
            sample={() => ({
              motion: "idle",
              emote: "",
              emoteUntil: 0,
              singing: false,
              color: draft.outfitColor,
              outfit: draft.outfit,
              name: "",
              gender: draft.gender,
              skinColor: draft.skinColor,
              hairColor: draft.hairColor,
              avatarModel: draft.avatarModel,
            })}
          />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <circleGeometry args={[1.15, 40]} />
            <meshStandardMaterial color="#241433" />
          </mesh>
          <OrbitControls enablePan={false} minDistance={1.7} maxDistance={4.6} minPolarAngle={0.7} maxPolarAngle={1.35} target={[0, 0.95, 0]} />
        </Canvas>
        <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-xs text-white/55">Kéo để xoay · hai ngón hoặc con lăn để phóng</p>
      </div>
      <form
        className="min-h-0 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <h1 className="text-2xl font-extrabold">Tạo nhân vật</h1>
        <p className="mt-1 text-sm leading-6 text-white/60">Ngoại hình này đi cùng tài khoản và hiện trong phòng karaoke.</p>
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">Giới tính</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" className={draft.gender === "male" ? "control bg-white/20" : "control"} onClick={() => chooseGender("male")}>Nam</button>
            <button type="button" className={draft.gender === "female" ? "control bg-white/20" : "control"} onClick={() => chooseGender("female")}>Nữ</button>
          </div>
        </fieldset>
        <Swatches label="Màu da" colors={SKIN_COLORS} value={draft.skinColor} onPick={(skinColor) => setDraft({ ...draft, skinColor })} />
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">Kiểu tóc</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {HAIR_STYLES.map((style) => (
              <button key={style} type="button" className={draft.avatarModel === style ? "control bg-white/20" : "control"} onClick={() => setDraft({ ...draft, avatarModel: style as HairStyleId })}>
                {style === "short" ? "Tóc ngắn" : "Tóc dài"}
              </button>
            ))}
          </div>
        </fieldset>
        <Swatches label="Màu tóc" colors={HAIR_COLORS} value={draft.hairColor} onPick={(hairColor) => setDraft({ ...draft, hairColor })} />
        <Swatches label="Màu trang phục" colors={LOOK_COLORS} value={draft.outfitColor} onPick={(outfitColor) => setDraft({ ...draft, outfitColor })} />
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">Phụ kiện</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {OUTFITS.map((outfit) => (
              <button key={outfit} type="button" className={draft.outfit === outfit ? "control bg-white/20" : "control"} onClick={() => setDraft({ ...draft, outfit: outfit as OutfitId })}>
                {outfit === "vest" ? "Áo vest" : "Áo hoodie"}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="control" onClick={randomize}>Ngẫu nhiên</button>
          <button type="button" className="control" onClick={() => setDraft(defaultAvatar(draft.gender))}>Đặt lại</button>
        </div>
        <button className="mt-4 w-full rounded-2xl bg-fuchsia-500 py-3 text-base font-semibold disabled:opacity-60" disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu nhân vật"}
        </button>
      </form>
    </main>
  );
}

function Swatches({ label, colors, value, onPick }: { label: string; colors: readonly string[]; value: string; onPick: (color: string) => void }) {
  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            aria-pressed={value === color}
            className="h-11 w-11 rounded-full border-2"
            style={{ background: color, borderColor: value === color ? "#ffffff" : "transparent" }}
            onClick={() => onPick(color)}
          />
        ))}
      </div>
    </fieldset>
  );
}
