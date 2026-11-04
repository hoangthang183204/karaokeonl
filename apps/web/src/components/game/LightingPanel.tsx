"use client";

import { DEFAULT_LIGHTING, LIGHT_MODES, canPerform, type LightMode } from "@karaoke/shared";
import { useEffect, useRef, useState } from "react";
import { applyLighting, lightingLive } from "@/game/lighting-runtime";
import { useSession } from "@/stores/session.store";
import { useTv } from "@/stores/tv.store";

const MODE_LABEL: Record<LightMode, string> = {
  normal: "Bình thường",
  chill: "Chill",
  party: "Party",
  disco: "Disco",
  "dance-show": "Dance Show",
  static: "Cố định",
  pulse: "Nhịp chậm",
  rainbow: "Cầu vồng",
  "music-reactive": "Theo nhạc",
  off: "Tắt hiệu ứng",
};

const MAIN_MODES: LightMode[] = ["normal", "chill", "party", "disco", "dance-show"];

export function LightingPanel({ onClose, embedded = false }: { onClose: () => void; embedded?: boolean }) {
  const permissions = useTv((state) => state.permissions);
  const hostId = useTv((state) => state.hostId);
  const myRole = useTv((state) => state.myRole);
  const userId = useSession((state) => state.user?.id);
  const send = useTv((state) => state.send);
  const [tick, setTick] = useState(0);
  const sendTimer = useRef(0);
  const allowed = canPerform({ userId: userId ?? "", role: myRole, displayName: "" }, "lights", permissions, hostId);

  useEffect(() => {
    const sync = () => setTick((value) => value + 1);
    window.addEventListener("karaoke-lights", sync);
    return () => window.removeEventListener("karaoke-lights", sync);
  }, []);

  const publish = (partial: Partial<typeof lightingLive>) => {
    applyLighting(partial);
    if (!allowed) return;
    window.clearTimeout(sendTimer.current);
    sendTimer.current = window.setTimeout(() => {
      const next = lightingLive;
      send("room:lights", {
        enabled: next.enabled,
        brightness: next.brightness,
        flashSpeed: next.flashSpeed,
        color: next.color,
        secondaryColor: next.secondaryColor,
        effectMode: next.effectMode,
        spotlightIntensity: next.spotlightIntensity,
        ambientIntensity: next.ambientIntensity,
        strobe: next.strobe,
        colorStyle: next.colorStyle,
        spotTarget: next.spotTarget,
        autoDance: next.autoDance,
      });
    }, 120);
  };

  const lights = lightingLive;
  void tick;

  return (
    <div className={embedded ? "text-sm" : "glass max-h-[calc(100dvh-19rem)] w-[min(100%,320px)] overflow-y-auto rounded-3xl p-3 text-sm"}>
      {embedded ? null : (
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-semibold leading-6">Điều khiển ánh sáng</h2>
          <button className="control" onClick={onClose}>Đóng</button>
        </div>
      )}
      <p className="text-xs leading-5 text-amber-100/80">Nhấp nháy nằm trong đèn 3D, tối đa 2 lần mỗi giây, không phủ trắng cả màn hình. Giảm nhấp nháy đổi strobe thành chuyển màu chậm.</p>
      {!allowed ? <p className="mt-2 text-xs text-white/60">Chỉ chủ phòng hoặc người được cấp quyền điều khiển mới đổi đèn cho cả phòng. Bạn vẫn có thể giảm hiệu ứng trên máy mình.</p> : null}
      <label className="mt-3 flex items-center justify-between gap-2">Nguồn
        <input type="checkbox" checked={lights.enabled} disabled={!allowed} onChange={(event) => publish({ enabled: event.target.checked })} />
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs leading-5">Độ sáng {Math.round(lights.brightness * 100)}%</span>
        <input className="touch-range" type="range" min={0} max={100} value={Math.round(lights.brightness * 100)} disabled={!allowed} onChange={(event) => publish({ brightness: Number(event.target.value) / 100 })} />
      </label>
      <label className="mt-2 block">
        <span className="mb-1 block text-xs leading-5">Tốc độ {lights.flashSpeed.toFixed(2)} Hz</span>
        <input className="touch-range" type="range" min={25} max={200} value={Math.round(lights.flashSpeed * 100)} disabled={!allowed} onChange={(event) => publish({ flashSpeed: Number(event.target.value) / 100 })} />
      </label>
      <div className="mt-1 flex gap-2 text-xs">
        <button className="control" disabled={!allowed} onClick={() => publish({ flashSpeed: 0.35 })}>Chậm</button>
        <button className="control" disabled={!allowed} onClick={() => publish({ flashSpeed: 0.7 })}>Vừa</button>
        <button className="control" disabled={!allowed} onClick={() => publish({ flashSpeed: 2 })}>Nhanh</button>
      </div>
      <div className="mt-3 flex gap-3">
        <label className="text-xs">Màu chính
          <input type="color" value={lights.color} disabled={!allowed} onChange={(event) => publish({ color: event.target.value })} />
        </label>
        <label className="text-xs">Màu phụ
          <input type="color" value={lights.secondaryColor} disabled={!allowed} onChange={(event) => publish({ secondaryColor: event.target.value })} />
        </label>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {MAIN_MODES.map((mode) => (
          <button key={mode} className={`rounded-2xl px-3 py-3 text-left text-sm font-semibold ${lights.effectMode === mode ? "bg-fuchsia-500" : "bg-white/10"}`} disabled={!allowed} onClick={() => publish({ effectMode: mode })}>
            {MODE_LABEL[mode]}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-xs">Chế độ khác
        <select className="mt-1 w-full rounded-xl bg-white/10 px-2 py-2" value={lights.effectMode} disabled={!allowed} onChange={(event) => publish({ effectMode: event.target.value as LightMode })}>
          {LIGHT_MODES.map((mode) => <option key={mode} value={mode}>{MODE_LABEL[mode]}</option>)}
        </select>
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["fixed", "cycle", "random"] as const).map((style) => (
          <button key={style} className={`control ${lights.colorStyle === style ? "ring-1 ring-white/50" : ""}`} disabled={!allowed} onClick={() => publish({ colorStyle: style })}>
            {style === "fixed" ? "Màu cố định" : style === "cycle" ? "Đổi màu" : "Màu ngẫu nhiên"}
          </button>
        ))}
      </div>
      <label className="mt-3 flex items-center justify-between gap-2">Strobe
        <input type="checkbox" checked={lights.strobe} disabled={!allowed} onChange={(event) => publish({ strobe: event.target.checked })} />
      </label>
      <label className="mt-2 flex items-center justify-between gap-2">Spotlight
        <input type="checkbox" checked={lights.spotlightIntensity > 0} disabled={!allowed} onChange={(event) => publish({ spotlightIntensity: event.target.checked ? 0.7 : 0 })} />
      </label>
      <div className="mt-2 flex gap-2">
        <button className={`control flex-1 ${lights.spotTarget === "stage" ? "ring-1 ring-white/50" : ""}`} disabled={!allowed} onClick={() => publish({ spotTarget: "stage" })}>Chiếu sân khấu</button>
        <button className={`control flex-1 ${lights.spotTarget === "dancer" ? "ring-1 ring-white/50" : ""}`} disabled={!allowed} onClick={() => publish({ spotTarget: "dancer" })}>Chiếu vũ công</button>
      </div>
      <label className="mt-3 flex items-center justify-between gap-2 text-xs">Tự bật Dance Show khi có vũ công
        <input type="checkbox" checked={lights.autoDance} disabled={!allowed} onChange={(event) => publish({ autoDance: event.target.checked })} />
      </label>
      {lights.effectMode === "music-reactive" ? <p className="mt-2 text-xs text-white/60">Chưa có dữ liệu nhịp từ YouTube. Đèn giữ màu tĩnh, không giả lập beat.</p> : null}
      <label className="mt-2 block">
        <span className="mb-1 block text-xs leading-5">Đèn sân khấu {Math.round(lights.spotlightIntensity * 100)}%</span>
        <input className="touch-range" type="range" min={0} max={100} value={Math.round(lights.spotlightIntensity * 100)} disabled={!allowed} onChange={(event) => publish({ spotlightIntensity: Number(event.target.value) / 100 })} />
      </label>
      <label className="mt-2 block">
        <span className="mb-1 block text-xs leading-5">Đèn nền {Math.round(lights.ambientIntensity * 100)}%</span>
        <input className="touch-range" type="range" min={0} max={100} value={Math.round(lights.ambientIntensity * 100)} disabled={!allowed} onChange={(event) => publish({ ambientIntensity: Number(event.target.value) / 100 })} />
      </label>
      <label className="mt-3 flex items-center justify-between gap-2 text-xs">Giảm nhấp nháy trên máy này
        <input type="checkbox" checked={lights.reduceMotion} onChange={(event) => applyLighting({ reduceMotion: event.target.checked })} />
      </label>
      <button className="control mt-3" disabled={!allowed} onClick={() => publish({ ...DEFAULT_LIGHTING })}>Khôi phục mặc định</button>
    </div>
  );
}
