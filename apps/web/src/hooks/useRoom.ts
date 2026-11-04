"use client";

import { estimateClockOffset, type LightMode, type RoomRole, type SongQueueItem } from "@karaoke/shared";
import { applyLighting } from "@/game/lighting-runtime";
import { npcBodies, propBodies, serviceRoster } from "@/game/runtime";
import type { Room } from "colyseus.js";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { localMotion, remoteBodies, remoteRoster } from "@/game/runtime";
import { useSession } from "@/stores/session.store";
import { useTv, type ChatLine, type RosterPlayer } from "@/stores/tv.store";

interface SchemaPlayer {
  id: string;
  name: string;
  role: string;
  x: number;
  y: number;
  z: number;
  rot: number;
  seated: boolean;
  seatId: string;
  singing: boolean;
  motion: string;
  outfit: string;
  gender: string;
  skinColor: string;
  hairColor: string;
  avatarModel: string;
  emote: string;
  emoteUntil: number;
  color: string;
  hand: string;
  handUntil: number;
  drunkLevel: number;
  cansDrunk: number;
}

interface SchemaChat {
  id: string;
  userId: string;
  name: string;
  text: string;
  at: number;
}

interface SchemaQueue {
  id: string;
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  requestedBy: string;
  requestedByName: string;
  status: SongQueueItem["status"];
  position: number;
  createdAt: number;
  durationSec: number;
}

interface KaraokeSchema {
  roomName: string;
  hostId: string;
  currentVideoId: string;
  currentSongTitle: string;
  currentThumbnail: string;
  currentChannelTitle: string;
  currentSongId: string;
  currentRequestedByName: string;
  playbackState: string;
  anchorTime: number;
  duration: number;
  revision: number;
  updatedAt: number;
  songSessionId: string;
  errorMessage: string;
  skipRequested: boolean;
  canPrevious: boolean;
  memberCanAddSong: boolean;
  memberCanVoteSkip: boolean;
  memberCanControlPlayback: boolean;
  coHostCanControlPlayback: boolean;
  hostOnlyCanClearQueue: boolean;
  skipThreshold: number;
  autoSkipOnThreshold: boolean;
  voteCooldownMs: number;
  voteDurationMs: number;
  lightEnabled: boolean;
  lightBrightness: number;
  lightFlashSpeed: number;
  lightColor: string;
  lightSecondaryColor: string;
  lightMode: string;
  lightSpotlight: number;
  lightAmbient: number;
  lightStrobe: boolean;
  lightColorStyle: string;
  lightSpotTarget: string;
  lightAutoDance: boolean;
  lightStartedAt: number;
  lightRevision: number;
  skipVoterIds: { toArray?: () => string[]; forEach: (fn: (value: string) => void) => void };
  queue: { forEach: (fn: (item: SchemaQueue) => void) => void };
  players: { forEach: (fn: (player: SchemaPlayer, id: string) => void) => void };
  chats: { forEach: (fn: (chat: SchemaChat) => void) => void };
  npcs: { forEach: (fn: (npc: SchemaNpc, id: string) => void) => void };
  props: { forEach: (fn: (prop: SchemaProp, id: string) => void) => void };
  orders: { forEach: (fn: (order: SchemaOrder, id: string) => void) => void };
}

interface SchemaNpc {
  role: string;
  service: string;
  phase: string;
  label: string;
  x: number;
  z: number;
  rot: number;
  ownerId: string;
  spot: string;
  style: string;
  paused: boolean;
}

interface SchemaProp {
  kind: string;
  x: number;
  z: number;
  remaining: number;
  ownerId: string;
  status: string;
}

interface SchemaOrder {
  playerId: string;
  service: string;
  status: string;
  spot: string;
  style: string;
}

function readList<T>(collection: { forEach: (fn: (item: T) => void) => void }): T[] {
  const items: T[] = [];
  collection.forEach((item) => items.push(item));
  return items;
}

function readStrings(collection: KaraokeSchema["skipVoterIds"]): string[] {
  if (collection.toArray) return collection.toArray();
  const items: string[] = [];
  collection.forEach((value) => items.push(value));
  return items;
}

export function useRoom(roomId: string) {
  const token = useSession((state) => state.token);
  const user = useSession((state) => state.user);

  useEffect(() => {
    if (!token || !user) return;
    let room: Room | null = null;
    let stopped = false;
    const samples: number[] = [];
    let tvSignature = "";
    let rosterSignature = "";
    let chatSignature = "";
    let lightSignature = "";

    const apply = (state: KaraokeSchema) => {
      const players: RosterPlayer[] = [];
      const ids: string[] = [];
      state.players.forEach((player, id) => {
        players.push({
          id,
          name: player.name,
          role: (player.role as RoomRole) || "member",
          seated: player.seated,
          color: player.color,
        });
        if (id === user.id) {
          if (!localMotion.ready) {
            localMotion.x = player.x;
            localMotion.y = player.y;
            localMotion.z = player.z;
            localMotion.rot = player.rot;
            localMotion.seated = player.seated;
            localMotion.seatId = player.seatId || "";
            localMotion.color = player.color || localMotion.color;
            localMotion.outfit = player.outfit || "hoodie";
            if (player.gender) {
              localMotion.gender = player.gender;
              localMotion.skinColor = player.skinColor || localMotion.skinColor;
              localMotion.hairColor = player.hairColor || localMotion.hairColor;
              localMotion.avatarModel = player.avatarModel || localMotion.avatarModel;
            }
            localMotion.ready = true;
          } else if (Math.hypot(player.x - localMotion.x, player.z - localMotion.z) > 1.25) {
            localMotion.x = player.x;
            localMotion.z = player.z;
          }
          if (player.seated && !localMotion.seated) {
            localMotion.seated = true;
            localMotion.seatId = player.seatId || "";
            localMotion.x = player.x;
            localMotion.z = player.z;
            localMotion.rot = player.rot;
          }
          localMotion.hand = player.hand || "";
          localMotion.handUntil = player.handUntil || 0;
          localMotion.drunk = player.drunkLevel || 0;
          localMotion.cansDrunk = player.cansDrunk || 0;
          return;
        }
        ids.push(id);
        remoteBodies.set(id, {
          id,
          name: player.name,
          color: player.color,
          outfit: player.outfit || "hoodie",
          gender: player.gender || "",
          skinColor: player.skinColor || "",
          hairColor: player.hairColor || "",
          avatarModel: player.avatarModel || "",
          x: player.x,
          y: player.y,
          z: player.z,
          rot: player.rot,
          seated: player.seated,
          seatId: player.seatId || "",
          singing: player.singing,
          motion: player.motion || (player.seated ? "sit" : "idle"),
          emote: player.emote,
          emoteUntil: player.emoteUntil,
          hand: player.hand || "",
          drunk: player.drunkLevel || 0,
        });
      });
      for (const id of remoteBodies.keys()) {
        if (!ids.includes(id)) remoteBodies.delete(id);
      }
      const nextRoster = ids.slice().sort().join(",");
      if (nextRoster !== remoteRoster.signature) {
        remoteRoster.signature = nextRoster;
        remoteRoster.ids = ids;
        window.dispatchEvent(new CustomEvent("karaoke-remotes"));
      }

      const npcIds: string[] = [];
      state.npcs?.forEach((npc, id) => {
        npcIds.push(id);
        npcBodies.set(id, {
          id,
          role: npc.role,
          service: npc.service,
          phase: npc.phase,
          label: npc.label,
          x: npc.x,
          z: npc.z,
          rot: npc.rot,
          ownerId: npc.ownerId || "",
          spot: npc.spot || "",
          style: npc.style || "",
          paused: Boolean(npc.paused),
        });
      });
      for (const id of npcBodies.keys()) {
        if (!npcIds.includes(id)) npcBodies.delete(id);
      }
      const propIds: string[] = [];
      state.props?.forEach((prop, id) => {
        propIds.push(id);
        propBodies.set(id, {
          id,
          kind: prop.kind,
          x: prop.x,
          z: prop.z,
          remaining: prop.remaining || 0,
          ownerId: prop.ownerId || "",
          status: prop.status || "",
        });
      });
      for (const id of propBodies.keys()) {
        if (!propIds.includes(id)) propBodies.delete(id);
      }
      const orders: { id: string; playerId: string; service: string; status: string; spot: string; style: string }[] = [];
      state.orders?.forEach((order, id) => {
        orders.push({
          id,
          playerId: order.playerId,
          service: order.service,
          status: order.status,
          spot: order.spot || "",
          style: order.style || "",
        });
      });
      const serviceKey = `${npcIds.map((id) => `${id}:${npcBodies.get(id)?.phase}:${npcBodies.get(id)?.paused ? 1 : 0}`).join(",")}|${propIds.map((id) => `${id}:${propBodies.get(id)?.remaining}`).join(",")}|${orders.map((order) => `${order.id}:${order.status}`).join(",")}`;
      if (serviceKey !== serviceRoster.signature) {
        serviceRoster.signature = serviceKey;
        serviceRoster.npcIds = npcIds;
        serviceRoster.propIds = propIds;
        serviceRoster.orders = orders;
        window.dispatchEvent(new CustomEvent("karaoke-service"));
      }

      const queue: SongQueueItem[] = readList(state.queue).map((item) => ({
        ...item,
        durationSec: item.durationSec > 0 ? item.durationSec : null,
      }));
      if (typeof state.lightRevision === "number") {
        const nextLight = [
          state.lightRevision,
          state.lightEnabled,
          state.lightBrightness,
          state.lightFlashSpeed,
          state.lightColor,
          state.lightSecondaryColor,
          state.lightMode,
          state.lightSpotlight,
          state.lightAmbient,
          state.lightStrobe,
          state.lightColorStyle,
          state.lightSpotTarget,
          state.lightAutoDance,
          state.lightStartedAt,
        ].join("|");
        if (nextLight !== lightSignature) {
          lightSignature = nextLight;
          applyLighting({
            enabled: state.lightEnabled,
            brightness: state.lightBrightness,
            flashSpeed: state.lightFlashSpeed,
            color: state.lightColor,
            secondaryColor: state.lightSecondaryColor,
            effectMode: state.lightMode as LightMode,
            spotlightIntensity: state.lightSpotlight,
            ambientIntensity: state.lightAmbient,
            strobe: state.lightStrobe === true,
            colorStyle: state.lightColorStyle === "cycle" || state.lightColorStyle === "random" ? state.lightColorStyle : "fixed",
            spotTarget: state.lightSpotTarget === "dancer" ? "dancer" : "stage",
            autoDance: state.lightAutoDance !== false,
            startedAt: state.lightStartedAt || 0,
            revision: state.lightRevision,
          });
        }
      }
      const signature = [
        state.roomName,
        state.revision,
        state.currentVideoId,
        state.songSessionId,
        state.playbackState,
        state.anchorTime,
        state.updatedAt,
        state.duration,
        state.errorMessage,
        state.hostId,
        state.canPrevious,
        state.skipRequested,
        readStrings(state.skipVoterIds).join(","),
        queue.map((item) => `${item.id}:${item.position}:${item.durationSec ?? 0}:${item.title}`).join(","),
        state.memberCanControlPlayback,
        state.coHostCanControlPlayback,
        state.memberCanAddSong,
        state.skipThreshold,
        state.autoSkipOnThreshold,
      ].join("|");

      const rosterKey = players.map((player) => `${player.id}:${player.role}:${player.name}:${player.seated}`).join("|");
      const chats = readList(state.chats);
      const chatKey = chats.map((chat) => chat.id).join(",");
      const me = players.find((player) => player.id === user.id);

      if (signature !== tvSignature || rosterKey !== rosterSignature || chatKey !== chatSignature) {
        tvSignature = signature;
        rosterSignature = rosterKey;
        chatSignature = chatKey;
        useTv.getState().patch({
          roomName: state.roomName,
          hostId: state.hostId,
          videoId: state.currentVideoId,
          title: state.currentSongTitle,
          thumbnail: state.currentThumbnail,
          channelTitle: state.currentChannelTitle,
          requestedByName: state.currentRequestedByName,
          songId: state.currentSongId,
          playbackState: state.playbackState,
          anchorTime: state.anchorTime,
          duration: state.duration,
          revision: state.revision,
          updatedAt: state.updatedAt,
          songSessionId: state.songSessionId,
          errorMessage: state.errorMessage,
          skipRequested: state.skipRequested,
          canPrevious: state.canPrevious,
          skipVoterIds: readStrings(state.skipVoterIds),
          skipThreshold: state.skipThreshold,
          queue,
          players,
          chats: chats as ChatLine[],
          myRole: me?.role ?? "member",
          permissions: {
            memberCanAddSong: state.memberCanAddSong,
            memberCanVoteSkip: state.memberCanVoteSkip,
            memberCanControlPlayback: state.memberCanControlPlayback,
            coHostCanControlPlayback: state.coHostCanControlPlayback,
            hostOnlyCanClearQueue: state.hostOnlyCanClearQueue,
            skipThreshold: state.skipThreshold,
            autoSkipOnThreshold: state.autoSkipOnThreshold,
            voteCooldownMs: state.voteCooldownMs,
            voteDurationMs: state.voteDurationMs,
          },
          connected: true,
          statusText: "Đã vào phòng",
        });
      }
    };

    const connect = async () => {
      try {
        await api(`/rooms/${roomId}/join`, { method: "POST" });
        if (stopped) return;
        const { Client } = await import("colyseus.js");
        const endpoint = process.env.NEXT_PUBLIC_COLYSEUS_URL || "ws://localhost:3001";
        const client = new Client(endpoint);
        room = await client.joinOrCreate("karaoke", { token, roomCode: roomId });
        if (stopped) {
          await room.leave();
          return;
        }
        useTv.getState().setRoom(room);
        apply(room.state as KaraokeSchema);
        room.onStateChange((state) => apply(state as KaraokeSchema));
        room.onMessage("tv:sync", (message: { serverNow: number }) => {
          samples.push(message.serverNow - Date.now());
          if (samples.length > 5) samples.shift();
          useTv.getState().patch({ clockOffsetMs: estimateClockOffset(samples), connected: true, statusText: "Đã đồng bộ" });
        });
        room.onMessage("tv:error", (message: { code?: string; message?: string }) => {
          if (message.code === "stale_revision" || message.code === "not_ended" || message.code === "duplicate_request") return;
          if (message.message?.includes("ghế") || message.message?.includes("Ghế")) {
            localMotion.seated = false;
            localMotion.seatId = "";
          }
          useTv.getState().patch({ notice: message.message || "Lệnh TV bị từ chối." });
        });
        room.onLeave(() => {
          useTv.getState().patch({ connected: false, statusText: "Mất kết nối realtime" });
        });
        room.onError(() => {
          useTv.getState().patch({ notice: "Lỗi kết nối phòng.", connected: false });
        });
      } catch (error) {
        useTv.getState().patch({
          connected: false,
          statusText: error instanceof Error ? error.message : "Không vào được phòng",
        });
      }
    };

    void connect();
    return () => {
      stopped = true;
      useTv.getState().setRoom(null);
      remoteBodies.clear();
      localMotion.ready = false;
      void room?.leave();
    };
  }, [roomId, token, user]);
}
