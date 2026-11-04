"use client";

import { LOOK_COLORS } from "@karaoke/shared";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { actions, joystick, localMotion, uiPointers, voiceHud } from "@/game/runtime";
import { requestId } from "@/lib/time";
import type { ChatLine, RosterPlayer } from "@/stores/tv.store";
import { useTv } from "@/stores/tv.store";
import { SongQueue } from "../youtube/SongQueue";
import { TVControlPanel } from "../youtube/TVControlPanel";
import { VoicePanel } from "../voice/VoicePanel";
import { LightingPanel } from "./LightingPanel";
import { ServiceMenu } from "./ServiceMenu";
import { CombatPad, FxToggles, PvpToggle } from "./CombatHud";

export type MobileSheet = "queue" | "lights" | "people" | "emote" | "settings" | "voice" | "service" | "desk" | null;

const EMOTES = [
  ["wave", "Vẫy"],
  ["clap", "Vỗ tay"],
  ["cheer", "Cổ vũ"],
  ["dance", "Nhảy"],
  ["laugh", "Cười"],
  ["heart", "Tim"],
] as const;

export function MobileHud({
  roomId,
  roomName,
  connected,
  statusText,
  players,
  chats,
  myRole,
  userId,
  sheet,
  setSheet,
  portrait,
  view,
  onToggleView,
  onSearch,
  onLeave,
  prompt,
  look,
  onLook,
  onEdit,
  peopleFooter,
}: {
  roomId: string;
  roomName: string;
  connected: boolean;
  statusText: string;
  players: RosterPlayer[];
  chats: ChatLine[];
  myRole: string;
  userId?: string;
  sheet: MobileSheet;
  setSheet: (sheet: MobileSheet) => void;
  portrait: boolean;
  view: "stage" | "follow";
  onToggleView: () => void;
  onSearch: () => void;
  onLeave: () => void;
  prompt: string;
  look: { color: string; outfit: string };
  onLook: (color: string, outfit: string) => void;
  onEdit?: () => void;
  peopleFooter?: ReactNode;
}) {
  const send = useTv((state) => state.send);
  const [chatText, setChatText] = useState("");
  const [deskTab, setDeskTab] = useState<"queue" | "lights" | "service">("queue");
  const [hint, setHint] = useState(true);
  const [voiceTick, setVoiceTick] = useState(0);
  const close = () => setSheet(null);

  useEffect(() => {
    const sync = () => setVoiceTick((value) => value + 1);
    window.addEventListener("karaoke-voice", sync);
    return () => window.removeEventListener("karaoke-voice", sync);
  }, []);
  void voiceTick;

  const open = (next: MobileSheet) => setSheet(sheet === next ? null : next);

  return (
    <>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 px-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.6rem,env(safe-area-inset-top))]">
        <div className="room-chip pointer-events-auto glass max-w-[42%] rounded-2xl px-3 py-2">
          <p className="truncate text-sm font-bold leading-5">{roomName || "Phòng karaoke"}</p>
          <p className="truncate text-xs leading-5 text-white/65">
            {players.length} người · {roomId.slice(0, 8)}
            {connected ? "" : ` · ${statusText}`}
          </p>
        </div>
        <div className="pointer-events-auto flex gap-1.5">
          <button className="icon-btn" aria-label="Đèn" title="Đèn" onClick={() => open("lights")}><LampIcon /></button>
          <button className="icon-btn" aria-label="Cài đặt" title="Cài đặt" onClick={() => open("settings")}><GearIcon /></button>
          <button className="icon-btn" data-on={voiceHud.mic ? "true" : "false"} aria-label="Micro" title={voiceHud.status} onClick={() => open("voice")}><MicIcon /></button>
          <button className="icon-btn" data-on={view === "stage" ? "true" : "false"} aria-label={view === "stage" ? "Đi lại" : "Xem TV"} title={view === "stage" ? "Đi lại" : "Xem TV"} onClick={onToggleView}><TvIcon /></button>
          <button className="icon-btn" aria-label="Rời phòng" title="Rời phòng" onClick={onLeave}><ExitIcon /></button>
        </div>
      </header>

      {portrait && hint ? (
        <div className="absolute left-1/2 top-[4.25rem] z-20 flex w-[min(100%-1.5rem,22rem)] -translate-x-1/2 items-center gap-2 rounded-2xl bg-black/75 px-3 py-2 text-xs leading-5">
          <p className="min-w-0 flex-1">Xoay ngang để thấy phòng rõ hơn. Bạn vẫn chơi được khi giữ dọc.</p>
          <button className="shrink-0 underline" onClick={() => setHint(false)}>Ẩn</button>
        </div>
      ) : null}

      <div className="mobile-dock">
        <TVControlPanel layout="dock" onSearch={onSearch} onQueue={() => open("queue")} />
      </div>

      <Joystick />
      <CombatPad className="absolute bottom-[calc(5.4rem+env(safe-area-inset-bottom))] right-[5.5rem] z-30" />

      <div className="absolute bottom-[max(0.7rem,env(safe-area-inset-bottom))] right-[max(0.7rem,env(safe-area-inset-right))] z-30 flex flex-col items-center gap-2">
        <button className="icon-btn" aria-label="Emote" title="Emote" onClick={() => open("emote")}><EmoteIcon /></button>
        <HoldButton label="Chạy" onHold={(held) => { actions.run = held; }} />
        <button className="action-btn" aria-label="Nhảy" onPointerDown={(event) => holdPointer(event, () => { actions.jump = true; })}>Nhảy</button>
        {prompt ? (
          <button className="action-btn" data-on="true" aria-label={prompt} onPointerDown={(event) => holdPointer(event, () => { actions.interact = true; })}>
            {prompt.length > 8 ? "Dùng" : prompt}
          </button>
        ) : null}
      </div>

      {sheet === "queue" ? (
        <Sheet title="Hàng chờ" onClose={close}>
          <SongQueue />
          <ChatBox chats={chats} chatText={chatText} setChatText={setChatText} send={send} />
        </Sheet>
      ) : null}
      {sheet === "lights" ? (
        <Sheet title="Điều khiển ánh sáng" onClose={close}>
          <LightingPanel embedded onClose={close} />
        </Sheet>
      ) : null}
      {sheet === "people" ? (
        <Sheet title="Người chơi" onClose={close}>
          <PeopleList players={players} myRole={myRole} userId={userId} />
          {peopleFooter}
        </Sheet>
      ) : null}
      {sheet === "emote" ? (
        <Sheet title="Emote" onClose={close}>
          <div className="grid grid-cols-3 gap-2">
            {EMOTES.map(([id, label]) => (
              <button key={id} className="control" onClick={() => { playEmote(id); close(); }}>{label}</button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-white/55">Muốn ngồi: đứng gần ghế, nút tương tác sẽ hiện ở góc phải.</p>
        </Sheet>
      ) : null}
      {sheet === "settings" ? (
        <Sheet title="Cài đặt" onClose={close}>
          <p className="text-xs leading-5 text-white/60">Màu và áo của nhân vật trong phòng này.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {LOOK_COLORS.map((color) => (
              <button key={color} aria-label={color} className="h-11 w-11 rounded-full border border-white/30" style={{ background: color }} onClick={() => onLook(color, look.outfit)} />
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button className="control" onClick={() => onLook(look.color, "hoodie")}>Áo hoodie</button>
            <button className="control" onClick={() => onLook(look.color, "vest")}>Áo vest</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {onEdit ? <button className="control" onClick={onEdit}>Sửa nhân vật</button> : null}
            <button className="control" onClick={() => open("people")}>Người chơi</button>
            <button className="control" onClick={() => open("service")}>Phục vụ</button>
            <button className="control" onClick={() => open("desk")}>Bàn karaoke</button>
          </div>
          <PvpToggle />
          <FxToggles />
          <p className="mt-3 text-xs leading-5 text-white/50">Vuốt joystick để đi. Vuốt nền bên phải để xoay camera. Nút Đấm, Đẩy, Né, Đỡ, Trêu nhắm người gần nhất.</p>
        </Sheet>
      ) : null}
      {sheet === "service" ? (
        <Sheet title="Phục vụ" onClose={close}>
          <ServiceMenu />
        </Sheet>
      ) : null}
      {sheet === "desk" ? (
        <Sheet title="Bàn karaoke" onClose={close}>
          <div className="mb-3 flex flex-wrap gap-2">
            <button className="control" onClick={() => setDeskTab("queue")}>Hàng chờ</button>
            <button className="control" onClick={() => { close(); onSearch(); }}>Tìm bài</button>
            <button className="control" onClick={() => setDeskTab("lights")}>Đèn</button>
            <button className="control" onClick={() => setDeskTab("service")}>Phục vụ</button>
          </div>
          {deskTab === "queue" ? <SongQueue /> : null}
          {deskTab === "lights" ? <LightingPanel embedded onClose={close} /> : null}
          {deskTab === "service" ? <ServiceMenu /> : null}
        </Sheet>
      ) : null}
      <div className={sheet === "voice" ? "sheet-scrim" : "sheet-scrim is-shut"} onClick={close}>
        <div className="sheet" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Giọng nói">
          <SheetHead title="Giọng nói" onClose={close} />
          <div className="sheet-body">
            <VoicePanel roomId={roomId} />
          </div>
        </div>
      </div>
    </>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <SheetHead title={title} onClose={onClose} />
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

function SheetHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 className="text-base font-bold leading-6">{title}</h2>
      <button className="control" onClick={onClose}>Đóng</button>
    </div>
  );
}

function PeopleList({ players, myRole, userId }: { players: RosterPlayer[]; myRole: string; userId?: string }) {
  const send = useTv((state) => state.send);
  const revision = useTv((state) => state.revision);
  return (
    <ul className="space-y-2">
      {players.map((player) => (
        <li key={player.id} className="rounded-2xl bg-white/5 px-3 py-2 text-sm leading-5">
          <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: player.color }} />
          {player.name}
          <span className="ml-1 text-xs text-white/50">{roleLabel(player.role)}{player.seated ? " · đang ngồi" : ""}</span>
          {myRole === "host" && player.id !== userId ? (
            <span className="mt-2 flex flex-wrap gap-2">
              <button className="control" onClick={() => send("tv:set-role", { requestId: requestId(), expectedRevision: revision, targetUserId: player.id, role: player.role === "cohost" ? "member" : "cohost" })}>
                {player.role === "cohost" ? "Bỏ co-host" : "Cho co-host"}
              </button>
              <button className="control" onClick={() => send("tv:transfer-host", { requestId: requestId(), expectedRevision: revision, targetUserId: player.id })}>Nhường host</button>
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ChatBox({
  chats,
  chatText,
  setChatText,
  send,
}: {
  chats: ChatLine[];
  chatText: string;
  setChatText: (value: string) => void;
  send: (type: string, payload?: Record<string, unknown>) => void;
}) {
  return (
    <>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!chatText.trim()) return;
          send("chat:send", { text: chatText });
          setChatText("");
        }}
      >
        <input value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="Nhắn phòng..." className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-3 text-sm outline-none" />
        <button className="control">Gửi</button>
      </form>
      <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-sm leading-5 text-white/75">
        {chats.map((chat) => (
          <li key={chat.id}><b className="text-white">{chat.name}:</b> {chat.text}</li>
        ))}
      </ul>
    </>
  );
}

function Joystick() {
  const active = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [held, setHeld] = useState(false);

  const place = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    let x = (event.clientX - rect.left - rect.width / 2) / (rect.width * 0.36);
    let y = (event.clientY - rect.top - rect.height / 2) / (rect.height * 0.36);
    const length = Math.hypot(x, y) || 1;
    if (length > 1) {
      x /= length;
      y /= length;
    }
    joystick.x = x;
    joystick.y = y;
    setKnob({ x: x * rect.width * 0.28, y: y * rect.height * 0.28 });
  };

  const release = (id: number) => {
    uiPointers.delete(id);
    if (active.current !== id) return;
    active.current = null;
    joystick.x = 0;
    joystick.y = 0;
    setKnob({ x: 0, y: 0 });
    setHeld(false);
  };

  return (
    <div
      className="joy absolute bottom-[max(0.7rem,env(safe-area-inset-bottom))] left-[max(0.7rem,env(safe-area-inset-left))] z-30"
      data-on={held ? "true" : "false"}
      aria-label="Di chuyển"
      onPointerDown={(event) => {
        uiPointers.add(event.pointerId);
        active.current = event.pointerId;
        setHeld(true);
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* synthetic pointer */ }
        place(event);
      }}
      onPointerMove={(event) => {
        if (active.current !== event.pointerId) return;
        place(event);
      }}
      onPointerUp={(event) => release(event.pointerId)}
      onPointerCancel={(event) => release(event.pointerId)}
    >
      <span className="joy-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

function HoldButton({ label, onHold }: { label: string; onHold: (held: boolean) => void }) {
  return (
    <button
      className="action-btn"
      aria-label={label}
      onPointerDown={(event) => holdPointer(event, () => onHold(true))}
      onPointerUp={(event) => { uiPointers.delete(event.pointerId); onHold(false); }}
      onPointerCancel={(event) => { uiPointers.delete(event.pointerId); onHold(false); }}
    >
      {label}
    </button>
  );
}

function holdPointer(event: ReactPointerEvent<HTMLButtonElement>, run: () => void) {
  uiPointers.add(event.pointerId);
  event.stopPropagation();
  try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* synthetic pointer */ }
  run();
}

function playEmote(id: string) {
  useTv.getState().send("player:emote", { emote: id });
  localMotion.emote = id;
  localMotion.emoteUntil = Date.now() + 2600;
  if (id === "wave" || id === "clap" || id === "dance" || id === "cheer") {
    localMotion.motion = (id === "cheer" ? "clap" : id) as typeof localMotion.motion;
  }
}

function roleLabel(role: string) {
  if (role === "host") return "chủ phòng";
  if (role === "cohost") return "đồng chủ";
  return "thành viên";
}

function LampIcon() {
  return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 8a5 5 0 1 1 10 0c0 2-1.2 3.2-2.2 4H6.2C5.2 11.2 4 10 4 8zm2.2 5h5.6v1.2H6.2V13zm1 2.2h3.6V16H7.2v-.8z" fill="currentColor" /></svg>;
}
function GearIcon() {
  return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M7.2 1.5h3.6l.4 2.1 1.5.6 1.8-1.2 2.5 2.5-1.2 1.8.6 1.5 2.1.4v3.6l-2.1.4-.6 1.5 1.2 1.8-2.5 2.5-1.8-1.2-1.5.6-.4 2.1H7.2l-.4-2.1-1.5-.6-1.8 1.2L1 14.6l1.2-1.8-.6-1.5L.5 10.9V7.3l2.1-.4.6-1.5L2 3.6 4.5 1l1.8 1.2 1.5-.6.4-2.1zM9 11.4A2.4 2.4 0 1 0 9 6.6a2.4 2.4 0 0 0 0 4.8z" fill="currentColor" /></svg>;
}
function MicIcon() {
  return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M6.5 3.5a2.5 2.5 0 0 1 5 0V8a2.5 2.5 0 0 1-5 0V3.5zM4 8a5 5 0 0 0 10 0h-1.4a3.6 3.6 0 0 1-7.2 0H4zm4.2 6.2V16h1.6v-1.8A6.4 6.4 0 0 0 15 8h-1.5a5 5 0 0 1-9 0H3a6.4 6.4 0 0 0 5.2 6.2z" fill="currentColor" /></svg>;
}
function TvIcon() {
  return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 4h14v8H2V4zm4 9h6v1.2H6V13z" fill="currentColor" /></svg>;
}
function ExitIcon() {
  return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 3h6v1.6H4.6v8.8H9V15H3V3zm8.2 2.2 3.3 3.3H7.5v1.6h7l-3.3 3.3 1.1 1.1L17.2 9l-4.9-4.9-1.1 1.1z" fill="currentColor" /></svg>;
}
function EmoteIcon() {
  return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M9 1.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM6.2 7.2a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm5.6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM9 13.2c1.8 0 3.2-1 3.8-2.2H5.2c.6 1.2 2 2.2 3.8 2.2z" fill="currentColor" /></svg>;
}
