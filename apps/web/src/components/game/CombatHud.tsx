"use client";

import { COMBAT, type CombatAction } from "@karaoke/shared";
import { useEffect, useState } from "react";
import { sendCombat } from "@/game/combat-client";
import { fxSettings, saveFxSettings } from "@/game/fx-settings";
import { localMotion, roomFlags, uiPointers } from "@/game/runtime";
import { useSession } from "@/stores/session.store";
import { useTv } from "@/stores/tv.store";

const ACTIONS: { id: CombatAction; label: string }[] = [
  { id: "punch", label: "Đấm" },
  { id: "push", label: "Đẩy" },
  { id: "dodge", label: "Né" },
  { id: "block", label: "Đỡ" },
  { id: "taunt", label: "Trêu" },
];

export function EyelidVeil() {
  const [cover, setCover] = useState(0);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setHidden(fxSettings.disableEyelids);
      if (fxSettings.disableEyelids) {
        setCover(0);
        return;
      }
      const hp = localMotion.hp;
      if (localMotion.hpState === "knocked_out") setCover(50);
      else if (hp > 0 && hp <= COMBAT.criticalHp) setCover(16 + ((COMBAT.criticalHp - hp) / COMBAT.criticalHp) * 26);
      else setCover(0);
    }, 120);
    return () => window.clearInterval(timer);
  }, []);
  if (hidden && cover === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[7]" aria-hidden="true">
      <div className="absolute inset-x-0 top-0 bg-black" style={{ height: `${cover}%`, transition: "height 420ms linear" }} />
      <div className="absolute inset-x-0 bottom-0 bg-black" style={{ height: `${cover}%`, transition: "height 420ms linear" }} />
    </div>
  );
}

export function CombatPad({ className }: { className: string }) {
  const [on, setOn] = useState(roomFlags.pvp);
  const [hp, setHp] = useState(localMotion.hp);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setOn(roomFlags.pvp);
      setHp(localMotion.hp);
    }, 200);
    return () => window.clearInterval(timer);
  }, []);
  if (!on) return null;
  const color = hp <= 20 ? "#fb7185" : hp <= 60 ? "#facc15" : "#34d399";
  return (
    <div className={`${className} pointer-events-auto grid w-[7.4rem] grid-cols-2 gap-1`}>
      {fxSettings.showHp ? (
        <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-black/50">
          <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, hp))}%`, background: color }} />
        </div>
      ) : null}
      {ACTIONS.map((action) => (
        <button
          key={action.id}
          className="action-btn"
          aria-label={action.label}
          onPointerDown={(event) => {
            uiPointers.add(event.pointerId);
            event.stopPropagation();
            try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* synthetic pointer */ }
            sendCombat(action.id);
          }}
          onClick={(event) => {
            event.stopPropagation();
            sendCombat(action.id);
          }}
          onPointerUp={(event) => uiPointers.delete(event.pointerId)}
          onPointerCancel={(event) => uiPointers.delete(event.pointerId)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

const TOGGLES: { key: keyof typeof fxSettings; label: string }[] = [
  { key: "showHp", label: "Hiện thanh máu" },
  { key: "reduceCamera", label: "Giảm lắc camera" },
  { key: "reduceBlur", label: "Giảm mờ khi say" },
  { key: "disableWarp", label: "Tắt méo hình khi say" },
  { key: "reduceMotion", label: "Giảm chuyển động màn hình" },
  { key: "disableEyelids", label: "Tắt hiệu ứng mí mắt" },
];

export function FxToggles() {
  const [version, setVersion] = useState(0);
  return (
    <div className="mt-3 space-y-2 text-sm">
      {TOGGLES.map((item) => (
        <label key={item.key} className="flex items-center justify-between gap-3">
          <span>{item.label}</span>
          <input
            type="checkbox"
            checked={item.key === "showHp" ? fxSettings.showHp : fxSettings[item.key]}
            onChange={(event) => {
              fxSettings[item.key] = event.target.checked;
              saveFxSettings();
              setVersion(version + 1);
            }}
          />
        </label>
      ))}
    </div>
  );
}

export function PvpToggle() {
  const send = useTv((state) => state.send);
  const hostId = useTv((state) => state.hostId);
  const userId = useSession((state) => state.user?.id);
  const [on, setOn] = useState(roomFlags.pvp);
  useEffect(() => {
    const timer = window.setInterval(() => setOn(roomFlags.pvp), 300);
    return () => window.clearInterval(timer);
  }, []);
  const host = Boolean(userId && userId === hostId);
  return (
    <label className="mt-3 flex items-center justify-between gap-3 text-sm">
      <span>Đối kháng trong phòng</span>
      <input
        type="checkbox"
        checked={on}
        disabled={!host}
        onChange={(event) => {
          setOn(event.target.checked);
          send("room:pvp", { enabled: event.target.checked });
        }}
      />
    </label>
  );
}
