"use client";

import { useRef } from "react";
import { usePlaybackSync } from "@/hooks/usePlaybackSync";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";

export function YouTubePlayer() {
  const slot = useRef<HTMLDivElement>(null);
  const service = useYouTubePlayer(slot);
  usePlaybackSync(service);
  return <div ref={slot} className="h-full w-full" />;
}
