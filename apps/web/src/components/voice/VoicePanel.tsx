"use client";

import { useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { api, ApiError } from "@/lib/api";
import { voiceHud } from "@/game/runtime";

function publishVoice(partial: Partial<typeof voiceHud>) {
  Object.assign(voiceHud, partial);
  window.dispatchEvent(new CustomEvent("karaoke-voice"));
}

function remoteAudio(): HTMLAudioElement[] {
  return [...document.querySelectorAll("audio[data-livekit='remote']")] as HTMLAudioElement[];
}

export function VoicePanel({ roomId }: { roomId: string }) {
  const [status, setStatus] = useState(voiceHud.status);
  const [enabled, setEnabled] = useState(voiceHud.mic);
  const [deaf, setDeaf] = useState(voiceHud.deaf);
  const [speakers, setSpeakers] = useState(voiceHud.speakers);
  const [room, setRoom] = useState<Room | null>(null);

  const note = (next: string) => {
    setStatus(next);
    publishVoice({ status: next });
  };

  useEffect(() => {
    return () => {
      room?.disconnect();
      document.querySelectorAll("audio[data-livekit='remote']").forEach((node) => node.remove());
    };
  }, [room]);

  const connectRef = useRef<() => Promise<void>>(async () => undefined);

  const connect = async () => {
    try {
      note("Đang xin quyền micro...");
      const data = await api<{ url: string; token: string }>(`/rooms/${roomId}/voice/token`, { method: "POST" });
      const livekit = await import("livekit-client");
      const voiceRoom = new livekit.Room();
      voiceRoom.on(livekit.RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== livekit.Track.Kind.Audio) return;
        const element = track.attach();
        element.dataset.livekit = "remote";
        element.autoplay = true;
        element.muted = voiceHud.deaf;
        document.body.appendChild(element);
      });
      voiceRoom.on(livekit.RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((element) => element.remove());
      });
      voiceRoom.on(livekit.RoomEvent.ActiveSpeakersChanged, (active) => {
        const names = active.map((speaker) => speaker.name || speaker.identity).filter(Boolean).join(", ");
        const line = names ? `Đang nói: ${names}` : "";
        setSpeakers(line);
        publishVoice({ speakers: line });
      });
      await voiceRoom.connect(data.url, data.token);
      await voiceRoom.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      setRoom(voiceRoom);
      setEnabled(true);
      publishVoice({ mic: true });
      note("Micro đang bật. Nên đeo tai nghe để loa TV không lọt vào micro.");
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
      if (denied) {
        note("Trình duyệt đang chặn micro. Hãy cấp quyền trong cài đặt trang, rồi bấm Bật micro.");
        return;
      }
      if (error instanceof ApiError && error.code === "voice_unconfigured") {
        note("Chưa cấu hình LiveKit. Giọng hát realtime chưa kết nối được. YouTube vẫn phát trên loa máy bạn.");
        return;
      }
      note(error instanceof Error ? error.message : "Không bật được micro.");
    }
  };

  connectRef.current = connect;

  useEffect(() => {
    const toggle = () => void connectRef.current();
    window.addEventListener("karaoke-toggle-mic", toggle);
    return () => window.removeEventListener("karaoke-toggle-mic", toggle);
  }, []);

  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-amber-100/90">Âm YouTube phát tại máy từng người. Micro đi đường riêng qua LiveKit, không trộn vào YouTube.</p>
      <p className="text-sm leading-5 text-white/80">{status}</p>
      <p className="text-xs leading-5 text-cyan-100">{speakers || "Chưa có ai đang nói"}</p>
      <div className="flex flex-wrap gap-2">
        {room ? (
          <button
            className="control"
            onClick={() => {
              const next = !enabled;
              void room.localParticipant.setMicrophoneEnabled(next, {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              });
              setEnabled(next);
              publishVoice({ mic: next });
              note(next ? "Micro đang bật." : "Micro đang tắt.");
            }}
          >
            {enabled ? "Tắt micro" : "Bật micro"}
          </button>
        ) : (
          <button className="rounded-full bg-cyan-300 px-4 py-2 font-semibold text-slate-950" onClick={() => void connect()}>
            Bật micro
          </button>
        )}
        <button
          className="control"
          onClick={() => {
            const next = !deaf;
            setDeaf(next);
            publishVoice({ deaf: next });
            remoteAudio().forEach((element) => {
              element.muted = next;
            });
            note(next ? "Đã tắt nghe phòng." : status);
          }}
        >
          {deaf ? "Bật nghe" : "Tắt nghe"}
        </button>
      </div>
    </div>
  );
}
