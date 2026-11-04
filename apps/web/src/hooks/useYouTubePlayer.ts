"use client";

import { useEffect, useState, type RefObject } from "react";
import { activePlayer, YouTubePlayerService } from "@/services/youtube/youtube-player.service";

export function useYouTubePlayer(slot: RefObject<HTMLDivElement | null>) {
  const [service, setService] = useState<YouTubePlayerService | null>(null);

  useEffect(() => {
    const host = slot.current;
    if (!host) return;
    const mountPoint = document.createElement("div");
    mountPoint.style.width = "100%";
    mountPoint.style.height = "100%";
    host.appendChild(mountPoint);
    const player = new YouTubePlayerService();
    let cancelled = false;
    const unsubscribe = player.subscribe(() => setService((current) => current ?? player));
    void player.mount(mountPoint).then(() => {
      if (cancelled) {
        player.destroy();
        return;
      }
      activePlayer.current = player;
      setService(player);
    });
    return () => {
      cancelled = true;
      unsubscribe();
      if (activePlayer.current === player) activePlayer.current = null;
      player.destroy();
      host.replaceChildren();
      setService(null);
    };
  }, [slot]);

  return service;
}
