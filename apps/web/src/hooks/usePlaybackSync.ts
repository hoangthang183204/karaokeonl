"use client";

import { planPlaybackSync, type PlaybackState } from "@karaoke/shared";
import { useEffect, useRef } from "react";
import { requestId } from "@/lib/time";
import type { YouTubePlayerService } from "@/services/youtube/youtube-player.service";
import { useTv } from "@/stores/tv.store";

export function usePlaybackSync(service: YouTubePlayerService | null) {
  const videoId = useTv((state) => state.videoId);
  const songSessionId = useTv((state) => state.songSessionId);
  const playbackState = useTv((state) => state.playbackState);
  const anchorTime = useTv((state) => state.anchorTime);
  const updatedAt = useTv((state) => state.updatedAt);
  const reportedDuration = useRef("");
  const bufferingSince = useRef(0);

  useEffect(() => {
    if (!service) return;
    const apply = () => {
      const tv = useTv.getState();
      const now = Date.now() + tv.clockOffsetMs;
      const plan = planPlaybackSync({
        remote: {
          currentVideoId: tv.videoId || null,
          playbackState: tv.playbackState as PlaybackState,
          anchorTime: tv.anchorTime,
          updatedAt: tv.updatedAt,
          duration: tv.duration,
          songSessionId: tv.songSessionId || null,
        },
        localVideoId: service.videoId,
        localTime: service.getCurrentTime(),
        localStatus: service.status,
        autoplayBlocked: service.autoplayBlocked,
        nowMs: now,
      });

      if (plan.type === "load") service.load(plan.videoId, plan.startSeconds, plan.autoplay);
      else if (plan.type === "play") service.play();
      else if (plan.type === "pause") service.pause();
      else if (plan.type === "seek") service.seek(plan.time);
      else if (plan.type === "seek-and-play") {
        service.seek(plan.time);
        service.play();
      } else if (plan.type === "seek-and-pause") {
        service.seek(plan.time);
        service.pause();
      } else if (plan.type === "idle") service.stop();

      if (tv.autoplayBlocked !== service.autoplayBlocked) {
        useTv.getState().patch({ autoplayBlocked: service.autoplayBlocked });
      }

      if (service.status === "buffering") {
        if (!bufferingSince.current) bufferingSince.current = Date.now();
        if (Date.now() - bufferingSince.current > 12000) {
          useTv.getState().patch({ notice: "Video đang tải lâu. Kiểm tra mạng hoặc bấm Đồng bộ." });
        }
      } else {
        bufferingSince.current = 0;
      }

      const duration = service.getDuration();
      const durationKey = `${tv.videoId}:${Math.round(duration)}`;
      if (tv.videoId && duration > 1 && reportedDuration.current !== durationKey && Math.abs(duration - tv.duration) > 0.8) {
        reportedDuration.current = durationKey;
        tv.send("tv:report-duration", { requestId: requestId(), videoId: tv.videoId, duration });
      }

      if (service.errorText && tv.videoId && (tv.myRole === "host" || tv.myRole === "cohost")) {
        const message = service.errorText;
        service.errorText = "";
        tv.send("tv:player-error", {
          requestId: requestId(),
          expectedRevision: tv.revision,
          videoId: tv.videoId,
          code: "youtube_player_error",
          message,
        });
      }
    };

    apply();
    const timer = window.setInterval(apply, 1000);
    return () => window.clearInterval(timer);
  }, [service, videoId, songSessionId, playbackState, anchorTime, updatedAt]);
}
