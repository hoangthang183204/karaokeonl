"use client";

import type { AvatarConfig } from "@karaoke/shared";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/stores/session.store";

const RoomExperience = dynamic(() => import("@/components/game/RoomExperience").then((mod) => mod.RoomExperience), {
  ssr: false,
  loading: () => <main className="grid h-[100dvh] place-items-center bg-ink text-white">Đang mở phòng karaoke...</main>,
});

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const hydrate = useSession((state) => state.hydrate);
  const ready = useSession((state) => state.ready);
  const token = useSession((state) => state.token);
  const [avatarReady, setAvatarReady] = useState(false);

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
      if (!avatar.isCreated) {
        router.replace(`/avatar?next=/rooms/${params.roomId}`);
        return;
      }
      setAvatarReady(true);
    }).catch(() => {
      if (!cancel) router.replace(`/avatar?next=/rooms/${params.roomId}`);
    });
    return () => {
      cancel = true;
    };
  }, [token, params.roomId, router]);

  if (!ready || !token || !avatarReady) return <main className="grid h-[100dvh] place-items-center bg-ink text-white">Đang kiểm tra đăng nhập...</main>;
  return <RoomExperience roomId={params.roomId} />;
}
