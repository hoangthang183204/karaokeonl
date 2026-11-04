"use client";

import { useEffect, useRef, useState } from "react";
import { parseYouTubeVideoId } from "@karaoke/shared";
import { ApiError, api } from "@/lib/api";
import { formatTime, requestId } from "@/lib/time";
import { useTv } from "@/stores/tv.store";

interface Hit {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  durationSec: number | null;
}

type SearchStatus = "idle" | "loading" | "results" | "empty" | "error" | "unconfigured" | "link";

function pastedVideoId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const id = parseYouTubeVideoId(trimmed);
  if (!id) return null;
  if (/^https?:\/\//i.test(trimmed) || /youtu\.?be|youtube/i.test(trimmed)) return id;
  return null;
}

export function YouTubeSearchModal({ roomId, open, onClose }: { roomId: string; open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [linkId, setLinkId] = useState("");
  const searchTimer = useRef(0);
  const requestSeq = useRef(0);
  const queryRef = useRef("");
  const revision = useTv((state) => state.revision);
  const send = useTv((state) => state.send);

  const runSearch = async (text: string) => {
    const trimmed = text.trim();
    const pasted = pastedVideoId(trimmed);
    if (pasted) {
      setLinkId(pasted);
      setHits([]);
      setMessage("");
      setStatus("link");
      return;
    }
    if (trimmed.length < 2) return;
    const seq = ++requestSeq.current;
    setStatus("loading");
    setMessage("");
    try {
      const data = await api<{ configured: boolean; results: Hit[]; message?: string }>(`/rooms/${roomId}/tv/search`, {
        method: "POST",
        body: JSON.stringify({ query: trimmed }),
      });
      if (seq !== requestSeq.current) return;
      if (!data.configured) {
        setHits([]);
        setStatus("unconfigured");
        setMessage("");
        return;
      }
      setHits(data.results);
      setStatus(data.results.length === 0 ? "empty" : "results");
      setMessage("");
    } catch (error) {
      if (seq !== requestSeq.current) return;
      setHits([]);
      setStatus("error");
      if (error instanceof ApiError) setMessage(error.message);
      else setMessage("Không kết nối được server tìm kiếm. Dán link YouTube bên dưới vẫn dùng được.");
    }
  };

  const scheduleSearch = (delay: number) => {
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => void runSearch(queryRef.current), delay);
  };

  useEffect(() => {
    return () => window.clearTimeout(searchTimer.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const queueVideo = (videoId: string, mode: "add-song" | "play-now") => {
    if (!parseYouTubeVideoId(videoId)) {
      setStatus("error");
      setMessage("Link hoặc mã video không hợp lệ.");
      return;
    }
    send(mode === "add-song" ? "tv:add-song" : "tv:play-now", {
      requestId: requestId(),
      expectedRevision: revision,
      videoId,
    });
    if (mode === "play-now") onClose();
  };

  const onQueryChange = (value: string) => {
    queryRef.current = value;
    setQuery(value);
    const pasted = pastedVideoId(value);
    if (pasted) {
      window.clearTimeout(searchTimer.current);
      requestSeq.current += 1;
      setLinkId(pasted);
      setHits([]);
      setMessage("");
      setStatus("link");
      return;
    }
    setLinkId("");
    if (value.trim().length < 2) {
      window.clearTimeout(searchTimer.current);
      requestSeq.current += 1;
      setHits([]);
      setMessage("");
      setStatus("idle");
      return;
    }
    setStatus("loading");
    scheduleSearch(350);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 lg:items-center lg:p-6" onClick={onClose}>
      <div
        className="glass max-h-[min(78dvh,40rem)] w-full overflow-y-auto rounded-t-3xl border border-fuchsia-400/20 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_0_40px_rgba(192,132,252,0.18)] lg:max-h-[86vh] lg:max-w-2xl lg:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-fuchsia-100">Tìm bài trên YouTube</h2>
            <p className="text-xs text-white/50">Video phát trên TV trong phòng, không mở tab YouTube.</p>
          </div>
          <button className="rounded-full border border-white/15 px-3 py-1 text-sm text-white/70" onClick={onClose}>Đóng</button>
        </div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              window.clearTimeout(searchTimer.current);
              void runSearch(queryRef.current);
            }}
            placeholder="Tên bài, ca sĩ, karaoke hoặc lyrics"
            className="min-w-0 flex-1 rounded-xl border border-fuchsia-300/20 bg-black/40 px-3 py-3 outline-none ring-cyan-300/40 focus:ring-2"
          />
          <button
            className="rounded-xl bg-fuchsia-500 px-4 py-3 font-semibold disabled:opacity-60"
            onClick={() => {
              window.clearTimeout(searchTimer.current);
              void runSearch(queryRef.current);
            }}
            disabled={status === "loading"}
          >
            {status === "loading" ? "Đang tìm" : "Tìm"}
          </button>
        </div>

        {status === "loading" ? <p className="mt-3 text-sm text-cyan-200">Đang tìm trên YouTube…</p> : null}
        {status === "unconfigured" ? (
          <p className="mt-3 rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            Chưa cấu hình YouTube Data API trên server. Tìm kiếm đang tắt. Bạn vẫn dán được link bên dưới.
          </p>
        ) : null}
        {status === "error" ? (
          <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{message}</p>
        ) : null}
        {status === "empty" ? <p className="mt-3 text-sm text-white/60">Không thấy video phù hợp.</p> : null}
        {status === "link" && linkId ? (
          <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3">
            <p className="text-sm font-medium text-cyan-100">Đây là link YouTube</p>
            <p className="mt-1 text-xs text-white/60">Mã video {linkId}. Tiêu đề lấy từ YouTube khi thêm bài, không hiện tên giả.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="rounded-lg bg-fuchsia-500 px-3 py-1.5 text-xs font-semibold" onClick={() => queueVideo(linkId, "play-now")}>Phát ngay</button>
              <button className="rounded-lg bg-white/10 px-3 py-1.5 text-xs" onClick={() => queueVideo(linkId, "add-song")}>Thêm vào hàng chờ</button>
            </div>
          </div>
        ) : null}

        <ul className="mt-3 space-y-2">
          {hits.map((hit) => (
            <li key={hit.videoId} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-2">
              {hit.thumbnail ? (
                <img src={hit.thumbnail} alt="" className="h-16 w-28 shrink-0 rounded-lg object-cover sm:h-[4.5rem] sm:w-32" />
              ) : (
                <div className="h-16 w-28 shrink-0 rounded-lg bg-white/10 sm:h-[4.5rem] sm:w-32" />
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-medium leading-snug">{hit.title}</p>
                <p className="mt-1 truncate text-xs text-cyan-100/70">{hit.channelTitle || "Kênh YouTube"}</p>
                {hit.durationSec ? <p className="text-xs text-white/50">{formatTime(hit.durationSec)}</p> : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="rounded-lg bg-fuchsia-500 px-3 py-1 text-xs font-semibold" onClick={() => queueVideo(hit.videoId, "play-now")}>Phát ngay</button>
                  <button className="rounded-lg bg-white/10 px-3 py-1 text-xs" onClick={() => queueVideo(hit.videoId, "add-song")}>Thêm vào hàng chờ</button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="mb-2 text-sm text-white/70">Dán link YouTube</p>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v= hoặc youtu.be"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950" onClick={() => queueVideo(url, "play-now")}>Phát ngay</button>
            <button className="rounded-xl bg-white/10 px-4 py-2 text-sm" onClick={() => queueVideo(url, "add-song")}>Thêm vào hàng chờ</button>
          </div>
        </div>
      </div>
    </div>
  );
}
