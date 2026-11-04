"use client";

import { drunkTier, drunkVisual } from "@karaoke/shared";
import { fxSettings } from "@/game/fx-settings";
import { localMotion, npcBodies, propBodies, serviceRoster } from "@/game/runtime";
import { useSession } from "@/stores/session.store";
import { useTv } from "@/stores/tv.store";
import { useEffect, useState } from "react";

const DRINKS = [
  { id: "juice", label: "Nước trái cây" },
  { id: "water", label: "Nước lọc" },
  { id: "soda", label: "Nước ngọt" },
  { id: "fruit", label: "Trái cây" },
  { id: "snack", label: "Đồ ăn nhẹ" },
];

const STYLES = [
  { id: "loop1", label: "Nhịp đều" },
  { id: "loop2", label: "Nhịp nhanh" },
  { id: "loop3", label: "Nhịp rộng" },
];

export function ServiceMenu() {
  const send = useTv((state) => state.send);
  const players = useTv((state) => state.players);
  const user = useSession((state) => state.user);
  const [tab, setTab] = useState<"drink" | "dance" | "live">("drink");
  const [spot, setSpot] = useState<"stage" | "table">("stage");
  const [style, setStyle] = useState("loop1");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const sync = () => setTick((value) => value + 1);
    window.addEventListener("karaoke-service", sync);
    return () => window.removeEventListener("karaoke-service", sync);
  }, []);
  void tick;
  const crate = [...propBodies.values()].find((prop) => prop.kind === "beer");
  const dancer = [...npcBodies.values()].find((npc) => npc.role === "dancer");
  const mine = user?.id ?? "";
  const role = players.find((player) => player.id === mine)?.role ?? "";
  const canDirect = Boolean(dancer && dancer.phase !== "idle" && (dancer.ownerId === mine || role === "host" || role === "cohost"));
  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-xs">
        <button className={`control ${tab === "drink" ? "ring-1 ring-white/50" : ""}`} onClick={() => setTab("drink")}>Đồ uống</button>
        <button className={`control ${tab === "dance" ? "ring-1 ring-white/50" : ""}`} onClick={() => setTab("dance")}>Vũ công</button>
        <button className={`control ${tab === "live" ? "ring-1 ring-white/50" : ""}`} onClick={() => setTab("live")}>Đang phục vụ</button>
      </div>
      {tab === "drink" ? (
        <div className="space-y-3">
          <div className="rounded-2xl bg-white/5 p-3">
            <div className="mb-2 flex items-center gap-3">
              <span className="grid h-14 w-14 shrink-0 grid-cols-4 gap-0.5 rounded-xl bg-amber-900/40 p-1.5">
                {Array.from({ length: 16 }, (_, index) => (
                  <span key={index} className="rounded-sm bg-amber-300" />
                ))}
              </span>
              <div>
                <p className="text-sm font-semibold">Thùng bia 24 lon</p>
                <p className="text-xs text-white/55">{crate ? `${crate.remaining}/24 lon · ${crate.status === "empty" ? "đã hết" : crate.status === "opened" ? "đang dùng" : "đầy"}` : "Chưa có thùng trên bàn."}</p>
              </div>
            </div>
            <button
              className="w-full rounded-2xl bg-fuchsia-500 px-3 py-3 text-sm font-semibold disabled:opacity-40"
              disabled={Boolean(crate && crate.remaining > 0)}
              onClick={() => send("room:service", { service: "beer" })}
            >
              {crate && crate.remaining > 0 ? "Bàn đang có thùng" : "Gọi thùng bia"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DRINKS.map((drink) => (
              <button key={drink.id} className="rounded-2xl bg-white/5 px-3 py-3 text-left text-sm" onClick={() => send("room:service", { service: drink.id })}>
                {drink.label}
              </button>
            ))}
            <button className="rounded-2xl bg-white/5 px-3 py-3 text-left text-sm" onClick={() => send("room:service", { service: "clear" })}>Thu dọn bàn</button>
          </div>
          <p className="text-xs text-white/50">Một nhân viên phục vụ một việc. Yêu cầu sau xếp hàng. Mỗi người chờ 8 giây giữa hai lần gọi.</p>
        </div>
      ) : null}
      {tab === "dance" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
            <span className="relative h-16 w-12 shrink-0">
              <span className="absolute left-1/2 top-0 h-5 w-5 -translate-x-1/2 rounded-full bg-[#f6d7c3]" />
              <span className="absolute left-1/2 top-1 h-4 w-6 -translate-x-1/2 rounded-t-full bg-[#1a1024]" />
              <span className="absolute bottom-0 left-1/2 h-8 w-7 -translate-x-1/2 rounded-md bg-[#f472b6]" />
            </span>
            <div>
              <p className="text-sm font-semibold">Lan Chi</p>
              <p className="text-xs text-white/55">Một vũ công. Ba nhịp nhảy trên cùng một nhân vật low-poly.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className={`control flex-1 ${spot === "stage" ? "ring-1 ring-white/50" : ""}`} onClick={() => setSpot("stage")}>Sân khấu</button>
            <button className={`control flex-1 ${spot === "table" ? "ring-1 ring-white/50" : ""}`} onClick={() => setSpot("table")}>Cạnh bàn</button>
          </div>
          <div className="flex gap-2">
            {STYLES.map((item) => (
              <button key={item.id} className={`control flex-1 ${style === item.id ? "ring-1 ring-white/50" : ""}`} onClick={() => setStyle(item.id)}>{item.label}</button>
            ))}
          </div>
          <button className="w-full rounded-2xl bg-fuchsia-500 px-3 py-3 text-sm font-semibold" onClick={() => send("room:service", { service: "dance", spot, style })}>
            Gọi vũ công
          </button>
        </div>
      ) : null}
      {tab === "live" ? (
        <div className="space-y-2 text-sm">
          <p className="text-xs text-white/55">Say của bạn: {drunkTier(localMotion.drunk)} · {localMotion.cansDrunk} lon đã uống xong</p>
          {serviceRoster.orders.length === 0 ? <p className="text-xs text-white/50">Chưa có yêu cầu.</p> : null}
          {serviceRoster.orders.map((order) => (
            <div key={order.id} className="rounded-2xl bg-white/5 px-3 py-2">
              <p className="font-semibold">{order.service === "dance" ? "Vũ công" : order.service === "beer" ? "Thùng bia" : order.service}</p>
              <p className="text-xs text-white/55">{order.status}{order.spot ? ` · ${order.spot === "table" ? "cạnh bàn" : "sân khấu"}` : ""}</p>
              {order.status === "pending" && order.playerId === mine ? (
                <button className="mt-2 text-xs text-white/70" onClick={() => send("room:service-control", { action: "cancel" })}>Hủy yêu cầu</button>
              ) : null}
            </div>
          ))}
          {canDirect && dancer && dancer.phase !== "idle" ? (
            <div className="flex flex-wrap gap-2">
              {dancer.phase === "work" || dancer.phase === "greet" ? (
                <button className="control" onClick={() => send("room:service-control", { action: dancer.paused ? "resume" : "pause" })}>{dancer.paused ? "Tiếp tục" : "Tạm dừng"}</button>
              ) : null}
              <button className="control" onClick={() => send("room:service-control", { action: "end" })}>Kết thúc</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function DrunkVeil() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 200);
    return () => window.clearInterval(timer);
  }, []);
  void tick;
  const knocked = localMotion.hpState === "knocked_out";
  const level = localMotion.drunk * (knocked ? 0.2 : 1);
  const fx = drunkVisual(level);
  const blurScale = (fxSettings.reduceBlur ? 0 : 1) * (fxSettings.reduceMotion ? 0.45 : 1);
  const blur = fx.blur * blurScale;
  if (blur < 0.05 && fx.vignette < 36) return null;
  const tint = fxSettings.disableWarp ? 0 : Math.min(0.28, fx.sway * 6);
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[6]"
      style={{
        backdropFilter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "none",
        boxShadow: `inset 0 0 ${fx.vignette.toFixed(0)}px rgba(0,0,0,0.55), inset 10px 0 18px rgba(255,70,110,${tint.toFixed(3)}), inset -10px 0 18px rgba(70,190,255,${tint.toFixed(3)})`,
      }}
    />
  );
}

export function DrinkBar() {
  const send = useTv((state) => state.send);
  const players = useTv((state) => state.players);
  const user = useSession((state) => state.user);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 200);
    return () => window.clearInterval(timer);
  }, []);
  void tick;
  const hand = localMotion.hand;
  const crate = [...propBodies.values()].find((prop) => prop.kind === "beer");
  const near = crate ? Math.hypot(crate.x - localMotion.x, crate.z - localMotion.z) < 3 : false;
  const role = players.find((player) => player.id === user?.id)?.role ?? "";
  const ownsCrate = !crate?.ownerId || crate.ownerId === user?.id || role === "host" || role === "cohost";
  if (!hand && !near) return null;
  const drinking = hand === "drinking" || hand === "opening";
  const total = hand === "opening" ? 700 : 2200;
  const left = Math.max(0, localMotion.handUntil - Date.now());
  const progress = drinking ? Math.min(1, 1 - left / total) : 0;
  return (
    <div className="pointer-events-auto absolute left-1/2 top-16 z-30 w-[min(100%-1.5rem,22rem)] -translate-x-1/2 rounded-3xl bg-black/70 p-2 text-sm">
      {drinking ? (
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-fuchsia-400" style={{ width: `${progress * 100}%` }} />
        </div>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        {!hand && ownsCrate && crate && crate.remaining > 0 ? <button className="rounded-2xl bg-fuchsia-500 px-3 py-2 font-semibold" onClick={() => { localMotion.action = "pickup"; localMotion.actionUntil = Date.now() + 700; send("beer:take", {}); }}>Lấy một lon</button> : null}
        {!hand && crate && crate.remaining <= 0 ? <button className="rounded-2xl bg-fuchsia-500 px-3 py-2 font-semibold" onClick={() => send("room:service", { service: "beer" })}>Gọi thùng tiếp</button> : null}
        {hand === "closed" ? <button className="rounded-2xl bg-white/10 px-3 py-2" onClick={() => send("beer:open", {})}>Mở lon</button> : null}
        {hand === "open" ? <button className="rounded-2xl bg-fuchsia-500 px-3 py-2 font-semibold" onClick={() => send("beer:drink", {})}>Uống</button> : null}
        {hand === "closed" || hand === "open" || hand === "empty" ? <button className="rounded-2xl bg-white/10 px-3 py-2" onClick={() => send("beer:place", {})}>Đặt xuống</button> : null}
        {hand === "empty" || hand === "open" || hand === "closed" ? <button className="rounded-2xl bg-white/10 px-3 py-2" onClick={() => send("beer:discard", {})}>Bỏ lon</button> : null}
        {drinking ? <button className="rounded-2xl bg-white/10 px-3 py-2" onClick={() => send("beer:cancel", {})}>Hủy</button> : null}
      </div>
    </div>
  );
}
