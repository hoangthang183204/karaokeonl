"use client";

import { defaultAvatar, type AvatarConfig } from "@karaoke/shared";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CharacterCreator } from "@/components/avatar/CharacterCreator";
import { applyAvatar } from "@/game/avatar-look";
import { api } from "@/lib/api";
import { useSession } from "@/stores/session.store";
import { Suspense } from "react";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function AvatarScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const hydrate = useSession((state) => state.hydrate);
  const ready = useSession((state) => state.ready);
  const token = useSession((state) => state.token);
  const user = useSession((state) => state.user);
  const [initial, setInitial] = useState<Omit<AvatarConfig, "userId" | "isCreated"> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (ready && !token) router.replace("/");
  }, [ready, token, router]);

  useEffect(() => {
    if (!token) return;
    let cancel = false;
    void api<AvatarConfig>("/auth/avatar").then((avatar) => {
      if (cancel) return;
      if (avatar.isCreated) {
        setInitial({
          gender: avatar.gender,
          skinColor: avatar.skinColor,
          hairColor: avatar.hairColor,
          outfitColor: avatar.outfitColor,
          avatarModel: avatar.avatarModel,
          outfit: avatar.outfit,
        });
        return;
      }
      setInitial(defaultAvatar("male"));
    }).catch(() => {
      if (!cancel) setInitial(defaultAvatar("male"));
    });
    return () => {
      cancel = true;
    };
  }, [token]);

  if (!ready || !user || !initial) {
    return <main className="grid h-[100dvh] place-items-center bg-ink text-white">Đang mở tạo nhân vật...</main>;
  }

  return (
    <>
      <CharacterCreator
        initial={initial}
        saving={saving}
        onSave={(draft) => {
          setSaving(true);
          setError("");
          void api<AvatarConfig>("/auth/avatar", { method: "PUT", body: JSON.stringify(draft) })
            .then((saved) => {
              applyAvatar(saved);
              router.push(safeNext(params.get("next")));
            })
            .catch((caught: unknown) => {
              setError(caught instanceof Error ? caught.message : "Không lưu được nhân vật.");
              setSaving(false);
            });
        }}
      />
      {error ? <p className="fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-rose-500 px-4 py-2 text-sm">{error}</p> : null}
    </>
  );
}

export default function AvatarPage() {
  return (
    <Suspense fallback={<main className="grid h-[100dvh] place-items-center bg-ink text-white">Đang mở tạo nhân vật...</main>}>
      <AvatarScreen />
    </Suspense>
  );
}
