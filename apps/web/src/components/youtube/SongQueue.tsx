"use client";

import { expectedPlaybackTime, canPerform, type PlaybackState } from "@karaoke/shared";
import { useEffect, useState } from "react";
import { formatTime, requestId } from "@/lib/time";
import { useSession } from "@/stores/session.store";
import { useTv } from "@/stores/tv.store";

export function SongQueue() {
  const queue = useTv((state) => state.queue);
  const title = useTv((state) => state.title);
  const thumbnail = useTv((state) => state.thumbnail);
  const videoId = useTv((state) => state.videoId);
  const requestedByName = useTv((state) => state.requestedByName);
  const playbackState = useTv((state) => state.playbackState);
  const anchorTime = useTv((state) => state.anchorTime);
  const updatedAt = useTv((state) => state.updatedAt);
  const duration = useTv((state) => state.duration);
  const revision = useTv((state) => state.revision);
  const send = useTv((state) => state.send);
  const permissions = useTv((state) => state.permissions);
  const hostId = useTv((state) => state.hostId);
  const myRole = useTv((state) => state.myRole);
  const userId = useSession((state) => state.user?.id);
  const actor = { userId: userId ?? "", role: myRole, displayName: "" };
  const control = canPerform(actor, "control", permissions, hostId);
  const clear = canPerform(actor, "clearQueue", permissions, hostId);
  const [shown, setShown] = useState(0);

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

  const move = (songId: string, position: number) => {
    send("tv:reorder", { requestId: requestId(), expectedRevision: revision, songId, position });
  };
  const progress = duration > 0 ? Math.min(100, (shown / duration) * 100) : 0;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-white/45">Đang phát</p>
        {videoId ? (
          <div className="mt-1 flex gap-2 rounded-2xl bg-white/5 p-2">
            {thumbnail ? <img src={thumbnail} alt="" className="h-14 w-24 rounded-lg object-cover" /> : <div className="h-14 w-24 rounded-lg bg-white/10" />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{title || "Video YouTube"}</p>
              <p className="truncate text-xs text-white/60">Người hát: {requestedByName || "Phòng karaoke"}</p>
              <p className="text-xs text-white/55">{formatTime(shown)}{duration > 0 ? ` / ${formatTime(duration)}` : ""} · {labelState(playbackState)}</p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-fuchsia-400" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm text-white/50">Chưa có bài hát. Bấm Chọn bài, tìm tên bài hoặc dán link YouTube.</p>
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-white/45">Tiếp theo</p>
        {clear && queue.length > 0 ? (
          <button className="text-xs text-rose-200" onClick={() => send("tv:clear-queue", { requestId: requestId(), expectedRevision: revision })}>Xóa hàng chờ</button>
        ) : null}
      </div>
      {queue.length === 0 ? <p className="text-sm text-white/50">Hàng chờ trống. Hãy tìm và thêm một bài.</p> : null}
      <ol className="space-y-2">
        {queue.map((song, index) => (
          <li
            key={song.id}
            draggable={control}
            onDragStart={(event) => event.dataTransfer.setData("text/plain", song.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const songId = event.dataTransfer.getData("text/plain");
              if (songId) move(songId, index);
            }}
            className="flex gap-2 rounded-2xl bg-white/5 p-2"
          >
            {song.thumbnail ? <img src={song.thumbnail} alt="" className="h-12 w-20 rounded-lg object-cover" /> : <div className="h-12 w-20 rounded-lg bg-white/10" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{String(index + 1).padStart(2, "0")}. {song.title}</p>
              <p className="truncate text-xs text-white/55">Thêm bởi {song.requestedByName || "khách"}{song.durationSec ? ` · ${formatTime(song.durationSec)}` : ""} · chờ</p>
              {control ? (
                <div className="mt-1 flex gap-2 text-xs">
                  <button onClick={() => move(song.id, index - 1)}>Lên</button>
                  <button onClick={() => move(song.id, index + 1)}>Xuống</button>
                  <button onClick={() => send("tv:play-now", { requestId: requestId(), expectedRevision: revision, songId: song.id })}>Phát</button>
                  <button className="text-rose-200" onClick={() => send("tv:remove-song", { requestId: requestId(), expectedRevision: revision, songId: song.id })}>Xóa</button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function labelState(state: string) {
  if (state === "playing") return "Playing";
  if (state === "paused") return "Paused";
  if (state === "buffering") return "Buffering";
  if (state === "ended") return "Đã hết";
  if (state === "error") return "Lỗi video";
  return "Chờ";
}
