"use client";

import { Canvas } from "@react-three/fiber";
import { LOOK_COLORS } from "@karaoke/shared";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { requestId } from "@/lib/time";
import { applyAvatar, lookMessage } from "@/game/avatar-look";
import { cameraRig, interactHud, localMotion } from "@/game/runtime";
import type { AvatarConfig } from "@karaoke/shared";
import { api } from "@/lib/api";
import { MobileHud, type MobileSheet } from "./MobileHud";
import { useRoom } from "@/hooks/useRoom";
import { useSession } from "@/stores/session.store";
import { useTv } from "@/stores/tv.store";
import { SongQueue } from "../youtube/SongQueue";
import { TVControlPanel } from "../youtube/TVControlPanel";
import { YouTubeSearchModal } from "../youtube/YouTubeSearchModal";
import { VoicePanel } from "../voice/VoicePanel";
import { LightingPanel } from "./LightingPanel";
import { DrinkBar, DrunkVeil, ServiceMenu } from "./ServiceMenu";
import { RoomScene } from "./RoomScene";
import { TVScreenOverlay } from "./TVScreenOverlay";

class RoomViewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <RoomViewFallback />;
    return this.props.children;
  }
}

function RoomViewFallback() {
  return (
    <div className="grid h-full place-items-center bg-ink px-6 text-center text-sm leading-6 text-white">
      Máy này không mở được hình 3D. Hãy tải lại trang, hoặc mở bằng Chrome mới hơn.
    </div>
  );
}

export function RoomExperience({ roomId }: { roomId: string }) {
  const router = useRouter();
  const user = useSession((state) => state.user);
  const roomName = useTv((state) => state.roomName);
  const statusText = useTv((state) => state.statusText);
  const connected = useTv((state) => state.connected);
  const notice = useTv((state) => state.notice);
  const players = useTv((state) => state.players);
  const chats = useTv((state) => state.chats);
  const myRole = useTv((state) => state.myRole);
  const permissions = useTv((state) => state.permissions);
  const revision = useTv((state) => state.revision);
  const send = useTv((state) => state.send);
  const [searchOpen, setSearchOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [lightsOpen, setLightsOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [consoleTab, setConsoleTab] = useState<"queue" | "lights" | "service">("queue");
  const laidOut = useRef(false);
  const [chatText, setChatText] = useState("");
  const [view, setView] = useState<"stage" | "follow">("follow");
  const [tier, setTier] = useState<"phone" | "tablet" | "desktop">("desktop");
  const [portrait, setPortrait] = useState(false);
  const [lowGpu, setLowGpu] = useState(false);
  const [viewFailed, setViewFailed] = useState(false);
  const [sheet, setSheet] = useState<MobileSheet>(null);
  const [leaveAsk, setLeaveAsk] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const tierRef = useRef(tier);
  tierRef.current = tier;
  const [look, setLook] = useState({ color: "#c084fc", outfit: "hoodie" });

  useRoom(roomId);

  useEffect(() => {
    const apply = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const next = width < 700 ? "phone" : width < 1100 || (coarse && width < 1280) ? "tablet" : "desktop";
      setTier(next);
      setPortrait(height > width && width < 900);
      const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      setLowGpu(typeof memory === "number" && memory <= 3);
      if (!laidOut.current && next === "desktop") {
        laidOut.current = true;
        setPeopleOpen(true);
        setQueueOpen(true);
      }
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  useEffect(() => {
    const open = () => {
      setSheet(null);
      setSearchOpen(true);
    };
    window.addEventListener("karaoke-open-search", open);
    const consoleEvent = () => {
      if (tierRef.current === "desktop") {
        setConsoleOpen(true);
        setConsoleTab("queue");
        return;
      }
      setSheet("desk");
    };
    window.addEventListener("karaoke-open-console", consoleEvent);
    const serviceEvent = () => {
      if (tierRef.current === "desktop") {
        setConsoleOpen(true);
        setConsoleTab("service");
        return;
      }
      setSheet("service");
    };
    window.addEventListener("karaoke-open-service", serviceEvent);
    return () => {
      window.removeEventListener("karaoke-open-search", open);
      window.removeEventListener("karaoke-open-console", consoleEvent);
      window.removeEventListener("karaoke-open-service", serviceEvent);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "b") {
        const tag = (event.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (tierRef.current === "desktop") setWheelOpen((open) => !open);
        else setSheet((open) => (open === "emote" ? null : "emote"));
        return;
      }
      if (event.key !== "Escape") return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (searchOpen) return;
      if (tierRef.current === "desktop") setMenuOpen((open) => !open);
      else setSheet((open) => (open ? null : "settings"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  useEffect(() => {
    const timer = window.setInterval(() => setPrompt(interactHud.label), 150);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!connected) return;
    const saved = window.localStorage.getItem("karaoke.look");
    const cached = window.localStorage.getItem("karaoke.avatar");
    if (cached) {
      try {
        const avatar = JSON.parse(cached) as AvatarConfig;
        if (avatar.gender && avatar.outfitColor) {
          applyAvatar(avatar);
          setLook({ color: avatar.outfitColor, outfit: avatar.outfit });
        }
      } catch {
        window.localStorage.removeItem("karaoke.avatar");
      }
    } else if (saved) {
      try {
        const parsed = JSON.parse(saved) as { color?: string; outfit?: string };
        if (parsed.color && parsed.outfit) {
          localMotion.color = parsed.color;
          localMotion.outfit = parsed.outfit;
          setLook({ color: parsed.color, outfit: parsed.outfit });
        }
      } catch {
        window.localStorage.removeItem("karaoke.look");
      }
    }
    send("player:look", lookMessage());
    let cancel = false;
    void api<AvatarConfig>("/auth/avatar").then((avatar) => {
      if (cancel || !avatar.isCreated) return;
      applyAvatar(avatar);
      setLook({ color: avatar.outfitColor, outfit: avatar.outfit });
      send("player:look", lookMessage());
    }).catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [connected, send]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => useTv.getState().patch({ notice: "" }), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <main className={`relative h-[100dvh] overflow-hidden bg-ink text-white ${portrait ? "is-portrait" : ""}`}>
      <RoomViewBoundary>
        {viewFailed ? <RoomViewFallback /> : (
          <Canvas
            style={{ background: "#090814", width: "100%", height: "100%" }}
            camera={{ position: [0, 1.78, 2.05], fov: tier === "phone" ? 60 : tier === "tablet" ? 54 : 48 }}
            dpr={lowGpu || tier === "phone" ? [1, 1] : tier === "tablet" ? [1, 1.15] : [1, 1.5]}
            gl={{
              alpha: false,
              antialias: tier === "desktop" && !lowGpu,
              powerPreference: tier === "desktop" && !lowGpu ? "high-performance" : "default",
              failIfMajorPerformanceCaveat: false,
            }}
            onCreated={({ gl }) => {
              gl.setClearColor("#090814");
              gl.domElement.addEventListener("webglcontextlost", (event) => {
                event.preventDefault();
                setViewFailed(true);
              });
            }}
          >
            <RoomScene />
          </Canvas>
        )}
      </RoomViewBoundary>
      <TVScreenOverlay />
      <DrunkVeil />
      <DrinkBar />

      {tier === "desktop" ? <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-start justify-between gap-3 p-3">
        <div className="pointer-events-auto glass rounded-2xl px-4 py-2">
          <p className="text-xs uppercase tracking-[0.2em] text-fuchsia-200">Karaoke Online</p>
          <h1 className="text-lg font-bold">{roomName || "Phòng karaoke"}</h1>
          <p className="text-xs text-white/60">{connected ? "Realtime đang kết nối" : statusText} · mã {roomId}</p>
        </div>
        <div className="pointer-events-auto flex max-w-[min(100%-18rem,46rem)] flex-wrap justify-end gap-2">
          <button className="control shrink-0" title="Điều khiển ánh sáng" onClick={() => setLightsOpen((open) => !open)}>Đèn</button>
          <button className="control shrink-0" onClick={() => setConsoleOpen((open) => !open)}>Bàn karaoke</button>
          <button className="control shrink-0" onClick={() => setWheelOpen((open) => !open)}>Emote</button>
          <button className="control shrink-0" onClick={() => setPeopleOpen((open) => !open)}>Người chơi</button>
          <button className="control shrink-0" onClick={() => setQueueOpen((open) => !open)}>Hàng chờ</button>
          <button className="control shrink-0" onClick={() => {
            const next = view === "stage" ? "follow" : "stage";
            cameraRig.mode = next;
            setView(next);
          }}>
            {view === "stage" ? "Đi lại" : "Xem TV"}
          </button>
          <button className="control shrink-0" onClick={() => askLeave(roomId, setLeaveAsk)}>Rời phòng</button>
        </div>
      </header> : null}

      {notice ? <div className={`absolute left-1/2 z-30 max-w-[min(100%-2rem,24rem)] -translate-x-1/2 rounded-2xl bg-black/75 px-4 py-2 text-center text-sm leading-5 ${tier === "desktop" ? "top-24" : "top-[4.6rem]"}`}>{notice}</div> : null}
      {tier === "desktop" && prompt ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 translate-y-16 rounded-full bg-black/70 px-4 py-2 text-sm">
          E · {prompt}
        </div>
      ) : null}
      {tier === "desktop" && menuOpen ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="glass w-full max-w-sm rounded-3xl p-4">
            <h2 className="text-lg font-bold">Menu</h2>
            <p className="mt-1 text-xs text-white/60">WASD di chuyển, Shift chạy, Space nhảy, E tương tác, chuột xoay camera.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {LOOK_COLORS.map((color) => (
                <button key={color} aria-label={color} className="h-8 w-8 rounded-full border border-white/30" style={{ background: color }} onClick={() => applyLook(color, look.outfit, setLook)} />
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button className="control" onClick={() => applyLook(look.color, "hoodie", setLook)}>Áo hoodie</button>
              <button className="control" onClick={() => applyLook(look.color, "vest", setLook)}>Áo vest</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="control" onClick={() => router.push(`/avatar?next=/rooms/${roomId}`)}>Sửa nhân vật</button>
              <button className="control" onClick={() => { setPeopleOpen(true); setMenuOpen(false); }}>Người chơi</button>
              <button className="control" onClick={() => { setQueueOpen(true); setMenuOpen(false); }}>Hàng chờ</button>
              <button className="control" onClick={() => { setLightsOpen(true); setMenuOpen(false); }}>Điều khiển ánh sáng</button>
              <button className="control" onClick={() => askLeave(roomId, setLeaveAsk)}>Rời phòng</button>
              <button className="control" onClick={() => setMenuOpen(false)}>Đóng</button>
            </div>
          </div>
        </div>
      ) : null}

      {tier === "desktop" && peopleOpen ? <aside className="absolute bottom-40 left-3 top-24 z-20 w-[min(100%-1.5rem,280px)] overflow-y-auto glass rounded-3xl p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Người chơi</h2>
          <button className="text-xs text-white/60" onClick={() => setPeopleOpen(false)}>Thu gọn</button>
        </div>
        <ul className="space-y-2">
          {players.map((player) => (
            <li key={player.id} className="rounded-2xl bg-white/5 px-3 py-2 text-sm">
              <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: player.color }} />
              {player.name}
              <span className="ml-1 text-xs text-white/50">{roleLabel(player.role)}{player.seated ? " · đang ngồi" : ""}</span>
              {myRole === "host" && player.id !== user?.id ? (
                <span className="mt-1 flex gap-2 text-xs">
                  <button onClick={() => send("tv:set-role", { requestId: requestId(), expectedRevision: revision, targetUserId: player.id, role: player.role === "cohost" ? "member" : "cohost" })}>
                    {player.role === "cohost" ? "Bỏ co-host" : "Cho co-host"}
                  </button>
                  <button onClick={() => send("tv:transfer-host", { requestId: requestId(), expectedRevision: revision, targetUserId: player.id })}>Nhường host</button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {myRole === "host" ? <PermissionToggles permissions={permissions} revision={revision} /> : null}
        <div className="mt-4 border-t border-white/10 pt-3">
          <VoicePanel roomId={roomId} />
        </div>
      </aside> : null}

      {tier === "desktop" && queueOpen ? <aside className="absolute bottom-40 right-3 top-24 z-20 w-[min(100%-1.5rem,340px)] overflow-y-auto glass rounded-3xl p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Hàng chờ</h2>
          <button className="text-xs text-white/60" onClick={() => setQueueOpen(false)}>Thu gọn</button>
        </div>
        <SongQueue />
        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!chatText.trim()) return;
            send("chat:send", { text: chatText });
            setChatText("");
          }}
        >
          <input value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="Nhắn phòng..." className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2 text-sm outline-none" />
          <button className="rounded-xl bg-white/10 px-3 text-sm">Gửi</button>
        </form>
        <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs text-white/75">
          {chats.map((chat) => (
            <li key={chat.id}><b className="text-white">{chat.name}:</b> {chat.text}</li>
          ))}
        </ul>
      </aside> : null}
      {tier === "desktop" && consoleOpen ? (
        <div className="absolute bottom-28 left-1/2 z-30 w-[min(100%-1.5rem,420px)] -translate-x-1/2">
          <div className="glass max-h-[calc(100dvh-18rem)] overflow-y-auto rounded-3xl p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Bàn karaoke</h2>
              <button className="text-xs text-white/60" onClick={() => setConsoleOpen(false)}>Đóng</button>
            </div>
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <button className="control" onClick={() => setConsoleTab("queue")}>Hàng chờ</button>
              <button className="control" onClick={() => setSearchOpen(true)}>Tìm bài</button>
              <button className="control" onClick={() => setConsoleTab("lights")}>Đèn</button>
              <button className="control" onClick={() => setConsoleTab("service")}>Phục vụ</button>
            </div>
            {consoleTab === "queue" ? <SongQueue /> : null}
            {consoleTab === "lights" ? <LightingPanel onClose={() => setConsoleTab("queue")} /> : null}
            {consoleTab === "service" ? <ServiceMenu /> : null}
          </div>
        </div>
      ) : null}
      {tier === "desktop" && wheelOpen ? (
        <div className="absolute bottom-28 left-1/2 z-30 flex -translate-x-1/2 flex-wrap justify-center gap-2">
          {[
            ["wave", "Vẫy"],
            ["clap", "Vỗ tay"],
            ["cheer", "Cổ vũ"],
            ["dance", "Nhảy"],
            ["laugh", "Cười"],
            ["heart", "Tim"],
          ].map(([id, label]) => (
            <button
              key={id}
              className="control"
              onClick={() => {
                useTv.getState().send("player:emote", { emote: id });
                localMotion.emote = id;
                localMotion.emoteUntil = Date.now() + 2600;
                if (id === "wave" || id === "clap" || id === "dance" || id === "cheer") {
                  localMotion.motion = (id === "cheer" ? "clap" : id) as typeof localMotion.motion;
                }
                setWheelOpen(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {tier === "desktop" && lightsOpen ? (
        <div className={`absolute top-24 z-30 ${queueOpen ? "right-3 lg:right-[360px]" : "right-3"}`}>
          <LightingPanel onClose={() => setLightsOpen(false)} />
        </div>
      ) : null}

      {tier === "desktop" ? (
        <div className="absolute inset-x-0 bottom-0 z-20 p-3">
          <div className="mx-auto max-w-4xl">
            <TVControlPanel onSearch={() => setSearchOpen(true)} />
          </div>
        </div>
      ) : (
        <MobileHud
          roomId={roomId}
          roomName={roomName}
          connected={connected}
          statusText={statusText}
          players={players}
          chats={chats}
          myRole={myRole}
          userId={user?.id}
          sheet={sheet}
          setSheet={setSheet}
          portrait={portrait}
          view={view}
          onToggleView={() => {
            const next = view === "stage" ? "follow" : "stage";
            cameraRig.mode = next;
            setView(next);
          }}
          onSearch={() => { setSheet(null); setSearchOpen(true); }}
          onLeave={() => askLeave(roomId, setLeaveAsk)}
          prompt={prompt}
          look={look}
          onLook={(color, outfit) => applyLook(color, outfit, setLook)}
          onEdit={() => router.push(`/avatar?next=/rooms/${roomId}`)}
          peopleFooter={myRole === "host" ? <PermissionToggles permissions={permissions} revision={revision} /> : null}
        />
      )}
      {leaveAsk ? (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/55 p-4 sm:items-center">
          <div className="glass w-full max-w-sm rounded-3xl p-4">
            <h2 className="text-lg font-bold">Rời phòng?</h2>
            <p className="mt-1 text-sm leading-6 text-white/70">Phòng đang có bài hoặc bạn đang ngồi. Rời phòng sẽ ngắt kết nối của bạn.</p>
            <div className="mt-4 flex gap-2">
              <button className="control" onClick={() => setLeaveAsk(false)}>Ở lại</button>
              <button className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold" onClick={() => void leave(roomId)}>Rời phòng</button>
            </div>
          </div>
        </div>
      ) : null}
      <YouTubeSearchModal roomId={roomId} open={searchOpen} onClose={() => setSearchOpen(false)} />
    </main>
  );
}

function PermissionToggles({
  permissions,
  revision,
}: {
  permissions: {
    memberCanAddSong: boolean;
    memberCanVoteSkip: boolean;
    memberCanControlPlayback: boolean;
    coHostCanControlPlayback: boolean;
    hostOnlyCanClearQueue: boolean;
    autoSkipOnThreshold: boolean;
    skipThreshold: number;
  };
  revision: number;
}) {
  const send = useTv((state) => state.send);
  const toggle = (key: string, value: boolean | number) => {
    send("tv:set-permissions", { requestId: requestId(), expectedRevision: revision, [key]: value });
  };
  return (
    <div className="mt-3 space-y-1 text-xs text-white/75">
      <p className="font-semibold text-white">Quyền TV</p>
      <label className="flex justify-between gap-2"><span>Member thêm bài</span><input type="checkbox" checked={permissions.memberCanAddSong} onChange={(event) => toggle("memberCanAddSong", event.target.checked)} /></label>
      <label className="flex justify-between gap-2"><span>Member vote skip</span><input type="checkbox" checked={permissions.memberCanVoteSkip} onChange={(event) => toggle("memberCanVoteSkip", event.target.checked)} /></label>
      <label className="flex justify-between gap-2"><span>Member điều khiển</span><input type="checkbox" checked={permissions.memberCanControlPlayback} onChange={(event) => toggle("memberCanControlPlayback", event.target.checked)} /></label>
      <label className="flex justify-between gap-2"><span>Co-host điều khiển</span><input type="checkbox" checked={permissions.coHostCanControlPlayback} onChange={(event) => toggle("coHostCanControlPlayback", event.target.checked)} /></label>
      <label className="flex justify-between gap-2"><span>Chỉ host xóa hàng chờ</span><input type="checkbox" checked={permissions.hostOnlyCanClearQueue} onChange={(event) => toggle("hostOnlyCanClearQueue", event.target.checked)} /></label>
      <label className="flex justify-between gap-2"><span>Đủ vote thì tự chuyển</span><input type="checkbox" checked={permissions.autoSkipOnThreshold} onChange={(event) => toggle("autoSkipOnThreshold", event.target.checked)} /></label>
      <label className="flex items-center justify-between gap-2">Ngưỡng vote
        <input className="w-16 rounded bg-white/10 px-2 py-1" type="number" min={1} max={50} value={permissions.skipThreshold} onChange={(event) => toggle("skipThreshold", Number(event.target.value))} />
      </label>
    </div>
  );
}

function applyLook(color: string, outfit: string, setLook: (look: { color: string; outfit: string }) => void) {
  localMotion.color = color;
  localMotion.outfit = outfit;
  setLook({ color, outfit });
  const cached = window.localStorage.getItem("karaoke.avatar");
  if (cached) {
    try {
      const avatar = JSON.parse(cached) as AvatarConfig;
      const nextOutfit = outfit === "vest" ? "vest" : "hoodie";
      applyAvatar({ ...avatar, outfitColor: color, outfit: nextOutfit });
    } catch {
      window.localStorage.setItem("karaoke.look", JSON.stringify({ color, outfit }));
    }
  } else {
    window.localStorage.setItem("karaoke.look", JSON.stringify({ color, outfit }));
  }
  useTv.getState().send("player:look", lookMessage());
}

function roleLabel(role: string) {
  if (role === "host") return "chủ phòng";
  if (role === "cohost") return "đồng chủ";
  return "thành viên";
}

function askLeave(roomId: string, ask: (value: boolean) => void) {
  const tv = useTv.getState();
  const busy = Boolean(tv.videoId && tv.playbackState !== "idle") || localMotion.seated;
  if (busy) ask(true);
  else void leave(roomId);
}

async function leave(roomId: string) {
  const room = useTv.getState().room;
  await room?.leave();
  window.location.href = `/?left=${roomId}`;
}
