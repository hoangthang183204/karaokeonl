"use client";

import { expectedPlaybackTime, type PlaybackState } from "@karaoke/shared";
import { useEffect, useState } from "react";
import { activePlayer } from "@/services/youtube/youtube-player.service";
import { formatTime, requestId } from "@/lib/time";
import { useSession } from "@/stores/session.store";
import { canPerform, type TvAction } from "@karaoke/shared";
import { useTv } from "@/stores/tv.store";
export function TVControlPanel({ onSearch, onQueue, layout = "full" }: { onSearch: () => void; onQueue?: () => void; layout?: "full" | "dock" }) {
  const playbackState = useTv((state) => state.playbackState);
  const anchorTime = useTv((state) => state.anchorTime);
  const updatedAt = useTv((state) => state.updatedAt);
  const duration = useTv((state) => state.duration);
  const title = useTv((state) => state.title);
  const videoId = useTv((state) => state.videoId);
  const thumbnail = useTv((state) => state.thumbnail);
  const canPrevious = useTv((state) => state.canPrevious);
  const skipVotes = useTv((state) => state.skipVoterIds);
  const skipRequested = useTv((state) => state.skipRequested);
  const skipThreshold = useTv((state) => state.skipThreshold);
  const send = useTv((state) => state.send);
  const permissions = useTv((state) => state.permissions);
  const hostId = useTv((state) => state.hostId);
  const myRole = useTv((state) => state.myRole);
  const userId = useSession((state) => state.user?.id);
  const [shown, setShown] = useState(0);
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const [open, setOpen] = useState(false);
  const access = {
    can: (action: TvAction) => canPerform({ userId: userId ?? "", role: myRole, displayName: "" }, action, permissions, hostId),
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      const tv = useTv.getState();
      setShown(expectedPlaybackTime({
        playbackState: tv.playbackState as PlaybackState,
        anchorTime: tv.anchorTime,
        updatedAt: tv.updatedAt,
        duration: tv.duration,
      }, Date.now() + tv.clockOffsetMs));
    }, 400);
    return () => window.clearInterval(timer);
  }, [anchorTime, updatedAt, playbackState, duration]);

  const command = (type: string, extra: Record<string, unknown> = {}) => {
    send(type, { requestId: requestId(), expectedRevision: useTv.getState().revision, ...extra });
  };

  const playing = playbackState === "playing";
  const art = thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/default.jpg` : "");
  const expanded = layout === "full" || open;

  return (
    <div className="glass pointer-events-auto rounded-3xl p-3">
      <div className="flex items-center gap-2">
        {art ? (
          <img src={art} alt="" className="h-11 w-16 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="h-11 w-16 shrink-0 rounded-lg bg-white/10" />
        )}
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => layout === "dock" && setOpen((value) => !value)}>
          <p className="truncate text-sm font-semibold leading-5">{videoId ? title || "Video YouTube" : "Chưa có bài hát"}</p>
          <p className="truncate text-xs leading-5 text-white/55">{playing ? "Đang phát" : playbackState === "paused" ? "Tạm dừng" : "Chưa phát"}</p>
        </button>
        {playing ? (
          <button disabled={!access.can("control")} className="icon-btn shrink-0" aria-label="Tạm dừng" onClick={() => command("tv:pause")}>
            <PauseIcon />
          </button>
        ) : (
          <button disabled={!access.can("control") || !videoId} className="icon-btn shrink-0" aria-label="Phát" onClick={() => command("tv:resume")}>
            <PlayIcon />
          </button>
        )}
        {onQueue ? (
          <button className="icon-btn shrink-0" aria-label="Hàng chờ" onClick={onQueue}>
            <QueueIcon />
          </button>
        ) : null}
        <button className={`shrink-0 rounded-full bg-fuchsia-500 font-semibold ${videoId ? "px-3 py-2 text-sm" : "px-4 py-2.5 text-sm"}`} onClick={onSearch}>
          Chọn bài
        </button>
      </div>
      {expanded ? (
        <>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs leading-5 text-white/60">
              <span>{formatTime(shown)}</span>
              <span>{duration > 0 ? formatTime(duration) : "—"}</span>
            </div>
            <input
              type="range"
              aria-label="Tiến trình bài hát"
              min={0}
              max={duration > 0 ? duration : Math.max(shown, 1)}
              step={0.1}
              value={Math.min(shown, duration > 0 ? duration : shown)}
              disabled={!access.can("control") || !videoId}
              onChange={(event) => command("tv:seek", { time: Number(event.target.value) })}
              className="touch-range"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button disabled={!access.can("control") || !canPrevious} className="control" onClick={() => command("tv:previous")}>Trước</button>
            <button disabled={!access.can("control")} className="control" onClick={() => command("tv:next")}>Tiếp</button>
            <button disabled={!access.can("voteSkip") || !videoId} className="control" onClick={() => command("tv:skip-vote")}>
              Vote skip {skipVotes.length}/{skipThreshold}
            </button>
            <button className="control" onClick={() => command("tv:request-sync")}>Đồng bộ</button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              className="control shrink-0"
              onClick={() => {
                const player = activePlayer.current;
                if (!player) return;
                if (muted) player.unmute();
                else player.mute();
                setMuted(!muted);
              }}
            >
              {muted ? "Bật tiếng" : "Tắt tiếng"}
            </button>
            <input
              type="range"
              aria-label="Âm lượng"
              className="touch-range min-w-0 flex-1"
              min={0}
              max={100}
              value={volume}
              onChange={(event) => {
                const next = Number(event.target.value);
                setVolume(next);
                activePlayer.current?.setVolume(next);
                if (next > 0 && muted) setMuted(false);
              }}
            />
          </div>
          {skipRequested ? <p className="mt-2 text-xs leading-5 text-amber-100">Phòng đã đủ vote để chuyển bài. Chủ phòng có thể bấm Tiếp.</p> : null}
          {!access.can("control") ? <p className="mt-2 text-xs leading-5 text-white/45">Bạn xem và thêm bài. Điều khiển phát thuộc chủ phòng hoặc người được cấp quyền.</p> : null}
        </>
      ) : null}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 2.5v11l10-5.5-10-5.5z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 2h3.2v12H3zM9.8 2H13v12H9.8z" fill="currentColor" />
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 3h12v1.6H2zM2 7.2h12v1.6H2zM2 11.4h8v1.6H2z" fill="currentColor" />
    </svg>
  );
}
