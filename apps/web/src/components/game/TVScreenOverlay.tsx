"use client";

import { useEffect, useRef } from "react";
import { screenFrame } from "@/game/runtime";
import { activePlayer } from "@/services/youtube/youtube-player.service";
import { useTv } from "@/stores/tv.store";
import { YouTubePlayer } from "../youtube/YouTubePlayer";

export function TVScreenOverlay() {
  const frame = useRef<HTMLDivElement>(null);
  const videoId = useTv((state) => state.videoId);
  const title = useTv((state) => state.title);
  const playbackState = useTv((state) => state.playbackState);
  const errorMessage = useTv((state) => state.errorMessage);
  const autoplayBlocked = useTv((state) => state.autoplayBlocked);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const node = frame.current;
      if (node) {
        node.style.display = screenFrame.visible ? "block" : "none";
        node.style.left = "0px";
        node.style.top = "0px";
        node.style.width = `${screenFrame.width}px`;
        node.style.height = `${screenFrame.height}px`;
        node.style.clipPath = "none";
        node.style.transformOrigin = "0 0";
        node.style.transform = screenFrame.transform;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={frame} className="tv-screen pointer-events-auto absolute left-0 top-0 z-[5] overflow-hidden bg-[#05060d]">
      <YouTubePlayer />
      {videoId ? null : (
        <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_center,#2a1848,#07060f_70%)] text-center">
          <div className="standby-glow mb-2 text-2xl font-black tracking-[0.18em] text-fuchsia-200 sm:text-4xl">KARAOKE</div>
          <p className="text-sm text-white/80 sm:text-base">Chưa có bài hát</p>
          <p className="mt-2 max-w-[80%] text-xs text-white/55">Ai trong phòng cũng chọn được bài hoặc dán link YouTube. Video sẽ hiện trên chiếc TV này.</p>
        </div>
      )}
      {videoId && playbackState === "error" && errorMessage ? (
        <p className="pointer-events-none absolute bottom-2 left-2 right-2 rounded bg-black/70 px-2 py-1 text-center text-xs text-rose-200">{errorMessage}</p>
      ) : null}
      {autoplayBlocked && videoId ? (
        <button
          className="absolute inset-0 z-10 grid place-items-center bg-black/45 px-4 text-center"
          onClick={() => {
            const player = activePlayer.current;
            player?.unmute();
            player?.play(true);
          }}
        >
          <span className="rounded-full bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-lg">Chạm để phát</span>
        </button>
      ) : null}
      <span className="sr-only">{title}</span>
    </div>
  );
}
