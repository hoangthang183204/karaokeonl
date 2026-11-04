"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AvatarConfig } from "@karaoke/shared";
import { api } from "@/lib/api";
import { useSession, type SessionUser } from "@/stores/session.store";

interface RoomCard {
  id: string;
  name: string;
  role: string;
}

export default function HomePage() {
  const router = useRouter();
  const hydrate = useSession((state) => state.hydrate);
  const ready = useSession((state) => state.ready);
  const user = useSession((state) => state.user);
  const setSession = useSession((state) => state.setSession);
  const clear = useSession((state) => state.clear);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [roomName, setRoomName] = useState("Phòng của tôi");
  const [joinCode, setJoinCode] = useState("");
  const [rooms, setRooms] = useState<RoomCard[]>([]);
  const [error, setError] = useState("");
  const [hasAvatar, setHasAvatar] = useState<boolean | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!user) {
      setHasAvatar(null);
      return;
    }
    let cancel = false;
    void api<AvatarConfig>("/auth/avatar")
      .then((avatar) => {
        if (cancel) return;
        setHasAvatar(avatar.isCreated);
        if (!avatar.isCreated) router.replace("/avatar");
      })
      .catch(() => {
        if (!cancel) setHasAvatar(false);
      });
    void api<RoomCard[]>("/rooms/mine").then(setRooms).catch(() => setRooms([]));
    return () => {
      cancel = true;
    };
  }, [user, router]);

  const submitAuth = async () => {
    setError("");
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const data = await api<{ token: string; user: SessionUser }>(path, {
        method: "POST",
        body: JSON.stringify({ email, password, displayName }),
      });
      setSession(data.token, data.user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không đăng nhập được.");
    }
  };

  const createRoom = async () => {
    setError("");
    try {
      const room = await api<{ id: string }>("/rooms", { method: "POST", body: JSON.stringify({ name: roomName }) });
      router.push(`/rooms/${room.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tạo được phòng.");
    }
  };

  const joinRoom = async () => {
    const id = joinCode.trim().toLowerCase();
    if (!/^[a-f0-9]{8}$/.test(id)) {
      setError("Mã phòng gồm 8 ký tự hex.");
      return;
    }
    router.push(`/rooms/${id}`);
  };

  return (
    <main className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,#3b1764,transparent_40%),linear-gradient(160deg,#07060f,#120818)] px-4 py-10 text-white">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <p className="text-sm uppercase tracking-[0.28em] text-fuchsia-200">Multiplayer web</p>
          <h1 className="mt-3 text-5xl font-extrabold leading-tight">KARAOKE ONLINE</h1>
          <p className="mt-4 max-w-xl text-white/75">
            Tạo phòng, ngồi vào ghế, chọn bài YouTube và hát cùng bạn bè. TV trong phòng dùng YouTube IFrame chính thức. Giọng hát đi qua LiveKit khi bạn đã cấu hình.
          </p>
          <p className="mt-4 max-w-xl text-sm text-white/45">
            Nhúng video không đồng nghĩa với giấy phép kinh doanh dịch vụ karaoke. Nên đeo tai nghe để tiếng TV không lọt vào micro.
          </p>
        </section>
        <section className="glass rounded-3xl p-5">
          {!ready ? <p>Đang tải phiên...</p> : null}
          {ready && !user ? (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void submitAuth();
              }}
            >
              <div className="flex gap-2 text-sm">
                <button type="button" className={mode === "login" ? "control bg-white/20" : "control"} onClick={() => setMode("login")}>Đăng nhập</button>
                <button type="button" className={mode === "register" ? "control bg-white/20" : "control"} onClick={() => setMode("register")}>Tạo tài khoản</button>
              </div>
              {mode === "register" ? (
                <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 outline-none" placeholder="Tên hiển thị" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              ) : null}
              <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 outline-none" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 outline-none" placeholder="Mật khẩu" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              <button className="w-full rounded-2xl bg-fuchsia-500 py-3 font-semibold" type="submit">{mode === "login" ? "Vào" : "Đăng ký"}</button>
            </form>
          ) : null}
          {user && hasAvatar === null ? <p>Đang kiểm tra nhân vật...</p> : null}
          {user && hasAvatar === false ? <p>Bạn chưa có nhân vật. Đang mở màn tạo nhân vật...</p> : null}
          {user && hasAvatar ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p>Xin chào, <b>{user.displayName}</b></p>
                <button className="text-sm text-white/60" onClick={clear}>Thoát</button>
              </div>
              <button className="control" onClick={() => router.push("/avatar")}>Sửa nhân vật</button>
              <div className="flex gap-2">
                <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 outline-none" value={roomName} onChange={(event) => setRoomName(event.target.value)} />
                <button className="rounded-2xl bg-fuchsia-500 px-4 font-semibold" onClick={() => void createRoom()}>Tạo phòng</button>
              </div>
              <div className="flex gap-2">
                <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 outline-none" placeholder="Mã phòng" value={joinCode} onChange={(event) => setJoinCode(event.target.value)} />
                <button className="rounded-2xl bg-cyan-300 px-4 font-semibold text-slate-950" onClick={() => void joinRoom()}>Vào</button>
              </div>
              <ul className="space-y-2 text-sm">
                {rooms.map((room) => (
                  <li key={room.id}>
                    <button className="w-full rounded-2xl bg-white/5 px-3 py-2 text-left" onClick={() => router.push(`/rooms/${room.id}`)}>
                      {room.name} · {room.id} · {room.role}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
        </section>
      </div>
    </main>
  );
}
