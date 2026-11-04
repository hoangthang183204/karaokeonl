import { HttpException } from "@nestjs/common";
import { Client, Room } from "colyseus";
import jwt from "jsonwebtoken";
import {
  EMOTES,
  SEATS,
  acceptRequest,
  isMotion,
  isOutfit,
  isGender,
  isHairStyle,
  isSkinColor,
  isHairColor,
  isOutfitColor,
  LOOK_COLORS,
  onStage,
  resolvePlayerMove,
  applyCommand,
  clampRoomPosition,
  colorFromId,
  canPerform,
  emptyServiceWorld,
  ensureStaff,
  errorMessage,
  requestService,
  controlService,
  beginOpen,
  beginDrink,
  cancelDrink,
  discardCan,
  placeCan,
  takeCan,
  tickHand,
  tickCombat,
  resolveCombat,
  isCombatAction,
  combatLocked,
  sanitizeLighting,
  stepDanceLight,
  tickServices,
  expectedPlaybackTime,
  migrateHost,
  tickPlayback,
  type Actor,
  type DanceLightHold,
  type EngineResult,
  type LightingState,
  type MemberRef,
  type RoomRole,
  type TVState,
  type TvCommand,
} from "@karaoke/shared";
import { roomBridge } from "./room-bridge";
import { liveRooms } from "./room-registry";
import { ChatState, KaraokeState, NpcState, OrderState, PlayerState, PropState, QueueItemState } from "./karaoke.state";

interface Session {
  userId: string;
  displayName: string;
  role: string;
  roomId: string;
  joinedAt: number;
  avatar?: {
    gender: string;
    skinColor: string;
    hairColor: string;
    outfitColor: string;
    avatarModel: string;
    outfit: string;
  };
}

type SessionClient = Client & { auth: Session };

function applySavedAvatar(player: PlayerState, avatar: NonNullable<Session["avatar"]>) {
  if (isGender(avatar.gender)) player.gender = avatar.gender;
  if (isSkinColor(avatar.skinColor)) player.skinColor = avatar.skinColor;
  if (isHairColor(avatar.hairColor)) player.hairColor = avatar.hairColor;
  if (isOutfitColor(avatar.outfitColor)) player.color = avatar.outfitColor;
  if (isHairStyle(avatar.avatarModel)) player.avatarModel = avatar.avatarModel;
  if (isOutfit(avatar.outfit)) player.outfit = avatar.outfit;
}

export class KaraokeRoom extends Room<KaraokeState> {
  engine!: TVState;
  private roomKey = "";
  private readonly requests = new Map<string, string[]>();
  private readonly pendingRemoval = new Map<string, { clear: () => void }>();
  private readonly services = emptyServiceWorld();
  private lightHold: DanceLightHold | null = null;

  async onCreate(options: { roomCode?: string }) {
    const roomId = String(options?.roomCode ?? "");
    if (!/^[a-f0-9]{8}$/.test(roomId)) throw new Error("Mã phòng không hợp lệ");
    if (!roomBridge.load) throw new Error("Server chưa sẵn sàng");
    this.setMetadata({ roomCode: roomId });
    const loaded = await roomBridge.load(roomId);
    this.roomKey = roomId;
    this.engine = loaded.state;
    this.maxClients = 50;
    this.setState(new KaraokeState());
    this.state.roomName = loaded.roomName;
    ensureStaff(this.services);
    this.syncServices();
    this.pushTv();
    liveRooms.set(roomId, this);
    this.setPatchRate(50);
    this.clock.setInterval(() => this.onTick(), 2000);
    this.clock.setInterval(() => this.stepServices(), 100);
    this.clock.setInterval(() => {
      this.broadcast("tv:sync", { serverNow: Date.now(), revision: this.engine.revision });
    }, 5000);
    this.bindMessages();
  }

  async onAuth(_client: Client, options: { token?: string; roomCode?: string }): Promise<Session> {
    if (!options?.token || !options.roomCode) throw new Error(errorMessage("unauthenticated"));
    const secret = process.env.JWT_SECRET;
    if (!secret || !roomBridge.getMember) throw new Error("Server chưa sẵn sàng");
    let payload: { sub?: string };
    try {
      payload = jwt.verify(options.token, secret) as { sub?: string };
    } catch {
      throw new Error(errorMessage("unauthenticated"));
    }
    if (!payload.sub) throw new Error(errorMessage("unauthenticated"));
    const member = await roomBridge.getMember(options.roomCode, payload.sub);
    if (!member) throw new Error(errorMessage("not_in_room"));
    const saved = member.user;
    return {
      userId: member.userId,
      displayName: saved.displayName,
      role: member.role,
      roomId: options.roomCode,
      joinedAt: member.joinedAt.getTime(),
      avatar: saved.avatarCreated
        ? {
            gender: saved.gender ?? "",
            skinColor: saved.skinColor ?? "",
            hairColor: saved.hairColor ?? "",
            outfitColor: saved.outfitColor ?? "",
            avatarModel: saved.avatarModel ?? "",
            outfit: saved.outfit ?? "hoodie",
          }
        : undefined,
    };
  }

  onJoin(client: Client, _options: unknown, auth?: Session) {
    if (!auth) return;
    const session = client as SessionClient;
    session.auth = auth;
    let player = this.state.players.get(auth.userId);
    if (!player) {
      player = new PlayerState();
      player.id = auth.userId;
      const index = this.state.players.size;
      const spawn = clampRoomPosition(-1.1 + index * 0.8, -1.40);
      player.rot = Math.PI;
      player.x = spawn.x;
      player.z = spawn.z;
      player.color = colorFromId(auth.userId);
      player.outfit = "hoodie";
      player.motion = "idle";
      this.state.players.set(auth.userId, player);
    }
    if (auth.avatar) applySavedAvatar(player, auth.avatar);
    player.name = auth.displayName.slice(0, 24);
    player.role = auth.role;
    player.joinedAt = auth.joinedAt;
    player.movedAt = Date.now();
    this.pendingRemoval.get(auth.userId)?.clear();
    this.pendingRemoval.delete(auth.userId);
    client.send("tv:sync", {
      serverNow: Date.now(),
      revision: this.engine.revision,
      anchorTime: this.engine.anchorTime,
      updatedAt: this.engine.updatedAt,
      playbackState: this.engine.playbackState,
      videoId: this.engine.currentVideoId ?? "",
    });
  }

  async onLeave(client: Client, consented: boolean) {
    const auth = (client as SessionClient).auth;
    if (!auth) return;
    if (!consented) {
      try {
        await this.allowReconnection(client, 20);
        return;
      } catch {
        // Hết thời gian chờ nối lại.
      }
    }
    this.scheduleRemoval(auth.userId);
  }

  private scheduleRemoval(userId: string) {
    this.pendingRemoval.get(userId)?.clear();
    const timer = this.clock.setTimeout(() => {
      this.pendingRemoval.delete(userId);
      const stillHere = this.clients.some((item) => (item as SessionClient).auth?.userId === userId);
      if (!stillHere) void this.removePlayer(userId);
    }, 1500);
    this.pendingRemoval.set(userId, timer);
  }

  async onDispose() {
    liveRooms.delete(this.roomKey);
    if (!this.engine) return;
    if (this.engine.playbackState === "playing") {
      const now = Date.now();
      this.engine = {
        ...this.engine,
        playbackState: "paused",
        anchorTime: expectedPlaybackTime(this.engine, now),
        updatedAt: now,
        revision: this.engine.revision + 1,
      };
    }
    try {
      await roomBridge.save?.(this.engine);
    } catch (error) {
      console.error("Không lưu được trạng thái TV khi đóng phòng", error);
    }
  }

  async dispatch(command: TvCommand): Promise<EngineResult> {
    if (this.hitLimit(`${command.actor.userId}:command`, 30, 10_000)) {
      return { ok: false, state: this.engine, error: { code: "rate_limited", message: errorMessage("rate_limited") } };
    }
    if ((command.type === "add-song" || command.type === "play-now") && this.hitLimit(`${command.actor.userId}:add`, 6, 60_000)) {
      return { ok: false, state: this.engine, error: { code: "rate_limited", message: errorMessage("rate_limited") } };
    }
    if (!acceptRequest(this.requests, command.actor.userId, command.requestId)) {
      return { ok: false, state: this.engine, error: { code: "duplicate_request", message: errorMessage("duplicate_request") } };
    }
    const result = applyCommand(this.engine, command);
    if (!result.ok) return result;
    this.engine = result.state;
    this.rememberRoles(result);
    this.pushTv();
    this.broadcast("tv:playback-changed", {
      revision: this.engine.revision,
      playbackState: this.engine.playbackState,
      videoId: this.engine.currentVideoId ?? "",
      anchorTime: this.engine.anchorTime,
      updatedAt: this.engine.updatedAt,
      serverNow: Date.now(),
    });
    void this.persist(result);
    return { ...result, state: this.engine };
  }

  private bindMessages() {
    this.onMessage("tv:add-song", (client, payload) => void this.handleVideo(client, payload, "add-song"));
    this.onMessage("tv:play-now", (client, payload) => void this.handleVideo(client, payload, "play-now"));
    this.onMessage("tv:pause", (client, payload) => void this.simple(client, payload, "pause"));
    this.onMessage("tv:resume", (client, payload) => void this.simple(client, payload, "resume"));
    this.onMessage("tv:seek", (client, payload) => void this.seek(client, payload));
    this.onMessage("tv:next", (client, payload) => void this.simple(client, payload, "next"));
    this.onMessage("tv:previous", (client, payload) => void this.simple(client, payload, "previous"));
    this.onMessage("tv:remove-song", (client, payload) => void this.removeSong(client, payload));
    this.onMessage("tv:clear-queue", (client, payload) => void this.simple(client, payload, "clear-queue"));
    this.onMessage("tv:reorder", (client, payload) => void this.reorder(client, payload));
    this.onMessage("tv:skip-vote", (client, payload) => void this.simple(client, payload, "skip-vote"));
    this.onMessage("tv:set-permissions", (client, payload) => void this.permissions(client, payload));
    this.onMessage("tv:transfer-host", (client, payload) => void this.transfer(client, payload));
    this.onMessage("tv:set-role", (client, payload) => void this.setRole(client, payload));
    this.onMessage("tv:ended", (client, payload) => void this.simple(client, payload, "ended"));
    this.onMessage("tv:report-duration", (client, payload) => void this.duration(client, payload));
    this.onMessage("tv:player-error", (client, payload) => void this.playerError(client, payload));
    this.onMessage("tv:request-sync", (client) => {
      client.send("tv:sync", {
        serverNow: Date.now(),
        revision: this.engine.revision,
        anchorTime: this.engine.anchorTime,
        updatedAt: this.engine.updatedAt,
        playbackState: this.engine.playbackState,
        videoId: this.engine.currentVideoId ?? "",
      });
    });
    this.onMessage("player:move", (client, payload) => this.move(client, payload));
    this.onMessage("player:sit", (client, payload) => this.sit(client, payload));
    this.onMessage("player:look", (client, payload) => this.look(client, payload));
    this.onMessage("room:lights", (client, payload) => this.lights(client, payload));
    this.onMessage("room:service", (client, payload) => this.service(client, payload));
    this.onMessage("room:service-control", (client, payload) => this.serviceControl(client, payload));
    this.onMessage("beer:take", (client) => this.beer(client, "take"));
    this.onMessage("beer:open", (client) => this.beer(client, "open"));
    this.onMessage("beer:drink", (client) => this.beer(client, "drink"));
    this.onMessage("beer:cancel", (client) => this.beer(client, "cancel"));
    this.onMessage("beer:place", (client) => this.beer(client, "place"));
    this.onMessage("beer:discard", (client) => this.beer(client, "discard"));
    this.onMessage("player:emote", (client, payload) => this.emote(client, payload));
    this.onMessage("combat:act", (client, payload) => this.combat(client, payload));
    this.onMessage("room:pvp", (client, payload) => this.setPvp(client, payload));
    this.onMessage("chat:send", (client, payload) => this.chat(client, payload));
  }

  private async handleVideo(client: Client, payload: unknown, type: "add-song" | "play-now") {
    const body = asRecord(payload);
    const actor = this.actor(client);
    const requestId = asString(body.requestId);
    const expectedRevision = asInt(body.expectedRevision);
    try {
      if (type === "play-now" && asString(body.songId)) {
        await this.reply(client, requestId, await this.dispatch({
          type,
          actor,
          requestId,
          expectedRevision,
          nowMs: Date.now(),
          songId: asString(body.songId),
        }));
        return;
      }
      const input = asString(body.url) || asString(body.videoId);
      if (!roomBridge.resolveVideo) throw new Error("Server chưa sẵn sàng");
      const video = await roomBridge.resolveVideo(input);
      await this.reply(client, requestId, await this.dispatch({
        type,
        actor,
        requestId,
        expectedRevision,
        nowMs: Date.now(),
        video,
      }));
    } catch (error) {
      const body = error instanceof HttpException ? error.getResponse() : null;
      const record = body && typeof body === "object" ? (body as { code?: string; message?: string }) : null;
      client.send("tv:error", {
        requestId,
        code: record?.code ?? "metadata_unavailable",
        message: record?.message ?? errorMessage("metadata_unavailable"),
      });
    }
  }

  private async simple(client: Client, payload: unknown, type: "pause" | "resume" | "next" | "previous" | "clear-queue" | "skip-vote" | "ended") {
    const body = asRecord(payload);
    const requestId = asString(body.requestId);
    await this.reply(client, requestId, await this.dispatch({
      type,
      actor: this.actor(client),
      requestId,
      expectedRevision: asInt(body.expectedRevision),
      nowMs: Date.now(),
    }));
  }

  private async seek(client: Client, payload: unknown) {
    const body = asRecord(payload);
    const requestId = asString(body.requestId);
    const time = Number(body.time);
    await this.reply(client, requestId, await this.dispatch({
      type: "seek",
      actor: this.actor(client),
      requestId,
      expectedRevision: asInt(body.expectedRevision),
      nowMs: Date.now(),
      time,
    }));
  }

  private async removeSong(client: Client, payload: unknown) {
    const body = asRecord(payload);
    const requestId = asString(body.requestId);
    await this.reply(client, requestId, await this.dispatch({
      type: "remove-song",
      actor: this.actor(client),
      requestId,
      expectedRevision: asInt(body.expectedRevision),
      nowMs: Date.now(),
      songId: asString(body.songId),
    }));
  }

  private async reorder(client: Client, payload: unknown) {
    const body = asRecord(payload);
    const requestId = asString(body.requestId);
    await this.reply(client, requestId, await this.dispatch({
      type: "reorder",
      actor: this.actor(client),
      requestId,
      expectedRevision: asInt(body.expectedRevision),
      nowMs: Date.now(),
      songId: asString(body.songId),
      position: asInt(body.position) ?? 0,
    }));
  }

  private async permissions(client: Client, payload: unknown) {
    const body = asRecord(payload);
    const requestId = asString(body.requestId);
    await this.reply(client, requestId, await this.dispatch({
      type: "set-permissions",
      actor: this.actor(client),
      requestId,
      expectedRevision: asInt(body.expectedRevision),
      nowMs: Date.now(),
      permissions: {
        memberCanAddSong: asBool(body.memberCanAddSong),
        memberCanVoteSkip: asBool(body.memberCanVoteSkip),
        memberCanControlPlayback: asBool(body.memberCanControlPlayback),
        coHostCanControlPlayback: asBool(body.coHostCanControlPlayback),
        hostOnlyCanClearQueue: asBool(body.hostOnlyCanClearQueue),
        autoSkipOnThreshold: asBool(body.autoSkipOnThreshold),
        skipThreshold: asInt(body.skipThreshold),
        voteCooldownMs: asInt(body.voteCooldownMs),
        voteDurationMs: asInt(body.voteDurationMs),
      },
    }));
  }

  private async transfer(client: Client, payload: unknown) {
    const body = asRecord(payload);
    const requestId = asString(body.requestId);
    await this.reply(client, requestId, await this.dispatch({
      type: "transfer-host",
      actor: this.actor(client),
      requestId,
      expectedRevision: asInt(body.expectedRevision),
      nowMs: Date.now(),
      targetUserId: asString(body.targetUserId),
      members: this.memberRefs(),
    }));
  }

  private async setRole(client: Client, payload: unknown) {
    const body = asRecord(payload);
    const requestId = asString(body.requestId);
    const role = body.role === "cohost" || body.role === "member" ? body.role : "member";
    await this.reply(client, requestId, await this.dispatch({
      type: "set-role",
      actor: this.actor(client),
      requestId,
      expectedRevision: asInt(body.expectedRevision),
      nowMs: Date.now(),
      targetUserId: asString(body.targetUserId),
      role,
    }));
  }

  private async duration(client: Client, payload: unknown) {
    const body = asRecord(payload);
    const requestId = asString(body.requestId) || `dur-${Date.now()}`;
    await this.reply(client, requestId, await this.dispatch({
      type: "report-duration",
      actor: this.actor(client),
      requestId,
      nowMs: Date.now(),
      videoId: asString(body.videoId),
      duration: Number(body.duration),
    }));
  }

  private async playerError(client: Client, payload: unknown) {
    const body = asRecord(payload);
    const requestId = asString(body.requestId) || `err-${Date.now()}`;
    await this.reply(client, requestId, await this.dispatch({
      type: "report-error",
      actor: this.actor(client),
      requestId,
      expectedRevision: asInt(body.expectedRevision),
      nowMs: Date.now(),
      videoId: asString(body.videoId),
      code: asString(body.code) || "youtube_player_error",
      message: asString(body.message) || errorMessage("youtube_player_error"),
    }));
  }

  private move(client: Client, payload: unknown) {
    const player = this.player(client);
    if (!player || player.seated || combatLocked(player) || player.combatUntil > Date.now()) return;
    const body = asRecord(payload);
    const now = Date.now();
    const x = Number(body.x);
    const y = Number(body.y);
    const z = Number(body.z);
    const rot = Number(body.rot);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const dt = Math.min(0.3, Math.max(0.05, (now - player.movedAt) / 1000));
    const others = [...this.state.players.values()]
      .filter((item) => item.id !== player.id)
      .map((item) => ({ x: item.x, z: item.z }));
    const running = asString(body.motion) === "run";
    const next = resolvePlayerMove(player, { x, z }, dt, running, others);
    player.x = next.x;
    player.z = next.z;
    player.y = Number.isFinite(y) ? Math.max(0, Math.min(1.8, y)) : 0;
    player.rot = Number.isFinite(rot) ? rot : player.rot;
    const motion = asString(body.motion);
    player.motion = isMotion(motion) ? motion : "idle";
    player.singing = Boolean(body.singing) && onStage(player.x, player.z);
    if (player.singing && player.motion === "idle") player.motion = "sing";
    player.movedAt = now;
  }

  private lights(client: Client, payload: unknown) {
    const actor = this.actor(client);
    if (!actor || !canPerform(actor, "lights", this.engine.permissions, this.engine.hostId)) {
      client.send("tv:error", { code: "forbidden", message: errorMessage("forbidden") });
      return;
    }
    const body = asRecord(payload);
    let next = sanitizeLighting(
      {
        enabled: body.enabled !== false,
        brightness: Number(body.brightness),
        flashSpeed: Number(body.flashSpeed),
        color: asString(body.color),
        secondaryColor: asString(body.secondaryColor),
        effectMode: asString(body.effectMode) as "static",
        spotlightIntensity: Number(body.spotlightIntensity),
        ambientIntensity: Number(body.ambientIntensity),
        strobe: body.strobe === true,
        colorStyle: asString(body.colorStyle) as "fixed",
        spotTarget: asString(body.spotTarget) as "stage",
        autoDance: body.autoDance !== false,
      },
      this.state.lightRevision + 1,
    );
    if (this.lightHold && next.autoDance && next.effectMode !== "dance-show") {
      this.lightHold = { mode: next.effectMode, spotTarget: next.spotTarget };
      next = { ...next, effectMode: "dance-show", spotTarget: "dancer" };
    }
    if (!next.autoDance) this.lightHold = null;
    this.writeLights(next, Date.now());
  }

  private look(client: Client, payload: unknown) {
    const player = this.player(client);
    if (!player) return;
    const body = asRecord(payload);
    const color = asString(body.color);
    const outfit = asString(body.outfit);
    const gender = asString(body.gender);
    const skinColor = asString(body.skinColor);
    const hairColor = asString(body.hairColor);
    const avatarModel = asString(body.avatarModel);
    if (isOutfitColor(color) || (LOOK_COLORS as readonly string[]).includes(color)) player.color = color;
    if (isOutfit(outfit)) player.outfit = outfit;
    if (isGender(gender)) player.gender = gender;
    if (isSkinColor(skinColor)) player.skinColor = skinColor;
    if (isHairColor(hairColor)) player.hairColor = hairColor;
    if (isHairStyle(avatarModel)) player.avatarModel = avatarModel;
  }

  private sit(client: Client, payload: unknown) {
    const player = this.player(client);
    if (!player || combatLocked(player)) return;
    const seatId = asString(asRecord(payload).seatId);
    if (!seatId) {
      player.seated = false;
      player.seatId = "";
      player.motion = "stand";
      player.singing = false;
      return;
    }
    const seat = SEATS.find((item) => item.id === seatId);
    if (!seat) return;
    const taken = [...this.state.players.values()].some((item) => item.seatId === seat.id && item.id !== player.id);
    if (taken) {
      client.send("tv:error", { code: "invalid_request", message: "Ghế này đã có người ngồi." });
      return;
    }
    if (Math.hypot(player.x - seat.x, player.z - seat.z) > 1.6) {
      client.send("tv:error", { code: "invalid_request", message: "Hãy đi lại gần ghế trước khi ngồi." });
      return;
    }
    player.x = seat.x;
    player.z = seat.z;
    player.y = 0;
    player.seated = true;
    player.seatId = seat.id;
    player.rot = seat.rot;
    player.motion = "sit";
    player.singing = false;
  }

  private emote(client: Client, payload: unknown) {
    const player = this.player(client);
    const emote = asString(asRecord(payload).emote);
    if (!player || combatLocked(player) || !EMOTES.includes(emote as (typeof EMOTES)[number])) return;
    if (this.hitLimit(`${player.id}:emote`, 4, 4000)) return;
    player.emote = emote;
    player.emoteUntil = Date.now() + 2600;
    if (emote === "wave" || emote === "clap" || emote === "dance" || emote === "cheer") {
      player.motion = emote === "cheer" ? "clap" : emote;
    }
  }

  private service(client: Client, payload: unknown) {
    const player = this.player(client);
    if (!player || combatLocked(player)) return;
    if (this.hitLimit(`${player.id}:service`, 4, 8000)) {
      client.send("tv:error", { code: "rate_limited", message: "Hãy chờ một chút trước khi gọi tiếp." });
      return;
    }
    const body = asRecord(payload);
    const result = requestService(this.services, {
      userId: player.id,
      service: asString(body.service),
      now: Date.now(),
      spot: asString(body.spot),
      style: asString(body.style),
    });
    if (!result.ok) {
      client.send("tv:error", { code: "invalid_request", message: result.message });
      return;
    }
    this.syncServices();
  }

  private serviceControl(client: Client, payload: unknown) {
    const player = this.player(client);
    if (!player) return;
    const result = controlService(this.services, {
      userId: player.id,
      role: player.role,
      action: asString(asRecord(payload).action),
      now: Date.now(),
    });
    if (!result.ok) {
      client.send("tv:error", { code: "invalid_request", message: result.message });
      return;
    }
    this.syncServices();
  }

  private beer(client: Client, action: "take" | "open" | "drink" | "cancel" | "place" | "discard") {
    const player = this.player(client);
    if (!player) return;
    if (combatLocked(player)) {
      client.send("tv:error", { code: "invalid_request", message: "Không dùng được lúc đang nằm." });
      return;
    }
    if (this.hitLimit(`${player.id}:beer`, 8, 4000)) return;
    const now = Date.now();
    const actor = { id: player.id, x: player.x, z: player.z, role: player.role };
    const result =
      action === "take" ? takeCan(this.services, actor, player, now)
      : action === "open" ? beginOpen(player, now)
      : action === "drink" ? beginDrink(player, now)
      : action === "cancel" ? cancelDrink(player, now)
      : action === "place" ? placeCan(this.services, actor, player)
      : discardCan(player);
    if (!result.ok) {
      client.send("tv:error", { code: "invalid_request", message: result.message });
      return;
    }
    this.syncServices();
  }

  private stepServices() {
    const now = Date.now();
    const moved = tickServices(this.services, now, 0.1);
    this.state.players.forEach((player) => {
      if (combatLocked(player)) {
        if (player.hand === "drinking") player.hand = "open";
        if (player.hand === "opening") player.hand = "closed";
      }
      tickHand(player, now, 0.1, player.seated);
      tickCombat(player, now);
    });
    if (moved) this.syncServices();
    this.applyDanceLight(now);
  }

  private readLights(): LightingState {
    return sanitizeLighting(
      {
        enabled: this.state.lightEnabled,
        brightness: this.state.lightBrightness,
        flashSpeed: this.state.lightFlashSpeed,
        color: this.state.lightColor,
        secondaryColor: this.state.lightSecondaryColor,
        effectMode: this.state.lightMode as LightingState["effectMode"],
        spotlightIntensity: this.state.lightSpotlight,
        ambientIntensity: this.state.lightAmbient,
        strobe: this.state.lightStrobe,
        colorStyle: this.state.lightColorStyle as LightingState["colorStyle"],
        spotTarget: this.state.lightSpotTarget as LightingState["spotTarget"],
        autoDance: this.state.lightAutoDance,
        startedAt: this.state.lightStartedAt,
      },
      this.state.lightRevision,
    );
  }

  private writeLights(next: LightingState, startedAt: number) {
    this.state.lightEnabled = next.enabled;
    this.state.lightBrightness = next.brightness;
    this.state.lightFlashSpeed = next.flashSpeed;
    this.state.lightColor = next.color;
    this.state.lightSecondaryColor = next.secondaryColor;
    this.state.lightMode = next.effectMode;
    this.state.lightSpotlight = next.spotlightIntensity;
    this.state.lightAmbient = next.ambientIntensity;
    this.state.lightStrobe = next.strobe;
    this.state.lightColorStyle = next.colorStyle;
    this.state.lightSpotTarget = next.spotTarget;
    this.state.lightAutoDance = next.autoDance;
    this.state.lightStartedAt = startedAt;
    this.state.lightRevision = next.revision;
  }

  private applyDanceLight(now: number) {
    const dancer = this.services.npcs.find((npc) => npc.id === "dancer");
    const performing = Boolean(dancer && (dancer.phase === "work" || dancer.phase === "greet") && !dancer.paused);
    const result = stepDanceLight(this.readLights(), this.lightHold, performing);
    this.lightHold = result.hold;
    if (!result.changed) return;
    this.writeLights({ ...result.state, revision: this.state.lightRevision + 1 }, now);
  }

  private syncServices() {
    const npcIds = new Set(this.services.npcs.map((npc) => npc.id));
    for (const npc of this.services.npcs) {
      let row = this.state.npcs.get(npc.id);
      if (!row) {
        row = new NpcState();
        row.id = npc.id;
        this.state.npcs.set(npc.id, row);
      }
      row.role = npc.role;
      row.service = npc.service;
      row.phase = npc.phase;
      row.label = npc.label;
      row.x = npc.x;
      row.z = npc.z;
      row.rot = npc.rot;
      row.ownerId = npc.ownerId;
      row.requestId = npc.requestId;
      row.spot = npc.spot;
      row.style = npc.style;
      row.paused = npc.paused;
    }
    for (const id of [...this.state.npcs.keys()]) {
      if (!npcIds.has(id)) this.state.npcs.delete(id);
    }
    const propIds = new Set(this.services.props.map((prop) => prop.id));
    for (const prop of this.services.props) {
      let row = this.state.props.get(prop.id);
      if (!row) {
        row = new PropState();
        row.id = prop.id;
        this.state.props.set(prop.id, row);
      }
      row.kind = prop.kind;
      row.x = prop.x;
      row.z = prop.z;
      row.remaining = prop.remaining;
      row.ownerId = prop.ownerId;
      row.status = prop.status;
      row.tableId = prop.tableId;
    }
    for (const id of [...this.state.props.keys()]) {
      if (!propIds.has(id)) this.state.props.delete(id);
    }
    const orderIds = new Set(this.services.orders.map((order) => order.requestId));
    for (const order of this.services.orders) {
      let row = this.state.orders.get(order.requestId);
      if (!row) {
        row = new OrderState();
        row.id = order.requestId;
        this.state.orders.set(order.requestId, row);
      }
      row.playerId = order.playerId;
      row.service = order.service;
      row.status = order.status;
      row.spot = order.spot;
      row.style = order.style;
      row.createdAt = order.createdAt;
    }
    for (const id of [...this.state.orders.keys()]) {
      if (!orderIds.has(id)) this.state.orders.delete(id);
    }
  }

  private combat(client: Client, payload: unknown) {
    const player = this.player(client);
    if (!player) return;
    if (this.hitLimit(`${player.id}:combat`, 10, 2000)) return;
    const body = asRecord(payload);
    const action = asString(body.action);
    if (!isCombatAction(action)) return;
    const targetId = asString(body.targetId);
    const target = targetId ? this.state.players.get(targetId) ?? null : null;
    const result = resolveCombat(player, target, action, Date.now(), this.state.pvpEnabled);
    if (!result.ok) client.send("tv:error", { code: "invalid_request", message: result.message });
  }

  private setPvp(client: Client, payload: unknown) {
    const actor = this.actor(client);
    if (!actor || actor.userId !== this.engine.hostId) {
      client.send("tv:error", { code: "forbidden", message: errorMessage("forbidden") });
      return;
    }
    this.state.pvpEnabled = asRecord(payload).enabled !== false;
  }

  private chat(client: Client, payload: unknown) {
    const player = this.player(client);
    if (!player) return;
    if (!roomBridge.allow?.(`${player.id}:chat`, 8, 10_000)) {
      client.send("tv:error", { code: "rate_limited", message: errorMessage("rate_limited") });
      return;
    }
    const text = asString(asRecord(payload).text).replace(/[<>]/g, "").trim().slice(0, 200);
    if (!text) return;
    const message = new ChatState();
    message.id = crypto.randomUUID();
    message.userId = player.id;
    message.name = player.name;
    message.text = text;
    message.at = Date.now();
    this.state.chats.push(message);
    while (this.state.chats.length > 20) this.state.chats.shift();
  }

  private onTick() {
    const now = Date.now();
    this.state.players.forEach((player) => {
      if (player.emote && player.emoteUntil < now) player.emote = "";
    });
    const hostName = this.state.players.get(this.engine.hostId)?.name ?? "Host";
    const ticked = tickPlayback(this.engine, now, { userId: this.engine.hostId, role: "host", displayName: hostName });
    if (!ticked.changed) return;
    this.engine = ticked.state;
    this.pushTv();
    this.broadcast("tv:playback-changed", {
      revision: this.engine.revision,
      playbackState: this.engine.playbackState,
      videoId: this.engine.currentVideoId ?? "",
      anchorTime: this.engine.anchorTime,
      updatedAt: this.engine.updatedAt,
      serverNow: now,
    });
    void roomBridge.save?.(this.engine).catch((error) => console.error(error));
    if (ticked.effect) void roomBridge.log?.(this.roomKey, ticked.effect.userId, ticked.effect.action, ticked.effect.detail);
  }

  private async removePlayer(userId: string) {
    const wasHost = this.engine.hostId === userId;
    this.state.players.delete(userId);
    if (!wasHost) {
      await roomBridge.applyRoleChanges?.({ roomId: this.roomKey, removeUserId: userId });
      return;
    }
    const result = migrateHost(this.engine, userId, this.memberRefs(), Date.now());
    this.engine = result.state;
    if (result.nextHost) {
      const next = this.state.players.get(result.nextHost.userId);
      if (next) next.role = "host";
      await roomBridge.applyRoleChanges?.({
        roomId: this.roomKey,
        hostId: result.nextHost.userId,
        updates: [{ userId: result.nextHost.userId, role: "host" }],
        removeUserId: userId,
      });
      void roomBridge.log?.(this.roomKey, result.nextHost.userId, "host_migrated", userId);
    } else {
      await roomBridge.applyRoleChanges?.({ roomId: this.roomKey, removeUserId: userId });
    }
    this.pushTv();
    this.broadcast("tv:playback-changed", {
      revision: this.engine.revision,
      playbackState: this.engine.playbackState,
      videoId: this.engine.currentVideoId ?? "",
      serverNow: Date.now(),
    });
  }

  private rememberRoles(result: EngineResult) {
    const change = result.effect?.hostChange;
    if (change) {
      const next = this.state.players.get(change.nextHostId);
      const prev = this.state.players.get(change.previousHostId);
      if (next) next.role = "host";
      if (prev) prev.role = change.previousBecomes;
    }
    const roleChange = result.effect?.roleChange;
    if (roleChange) {
      const target = this.state.players.get(roleChange.userId);
      if (target) target.role = roleChange.role;
    }
  }

  private async persist(result: EngineResult) {
    try {
      if (result.effect?.hostChange) {
      const updates: { userId: string; role: "host" | "cohost" | "member" }[] = [
        { userId: result.effect.hostChange.nextHostId, role: "host" },
      ];
      if (result.effect.hostChange.previousBecomes !== "gone") {
        updates.push({ userId: result.effect.hostChange.previousHostId, role: result.effect.hostChange.previousBecomes });
      }
      await roomBridge.applyRoleChanges?.({
        roomId: this.roomKey,
        hostId: result.effect.hostChange.nextHostId,
        updates,
      });
      }
      if (result.effect?.roleChange) {
        await roomBridge.applyRoleChanges?.({
          roomId: this.roomKey,
          updates: [{ userId: result.effect.roleChange.userId, role: result.effect.roleChange.role }],
        });
      }
      if (result.effect?.vote) {
        await roomBridge.recordVote?.(this.roomKey, result.effect.vote.songSessionId, result.effect.vote.userId);
      }
      if (result.effect) {
        await roomBridge.log?.(this.roomKey, result.effect.userId, result.effect.action, result.effect.detail);
      }
      await roomBridge.save?.(this.engine);
    } catch (error) {
      console.error("Không lưu được lệnh TV", error);
    }
  }

  private pushTv() {
    const tv = this.engine;
    const state = this.state;
    state.roomId = tv.roomId;
    state.hostId = tv.hostId;
    state.currentVideoId = tv.currentVideoId ?? "";
    state.currentSongTitle = tv.currentSongTitle ?? "";
    state.currentThumbnail = tv.currentThumbnail ?? "";
    state.currentChannelTitle = tv.currentChannelTitle ?? "";
    state.currentSongId = tv.currentSongId ?? "";
    state.currentRequestedByName = tv.currentRequestedByName ?? "";
    state.playbackState = tv.playbackState;
    state.anchorTime = tv.anchorTime;
    state.duration = tv.duration;
    state.revision = tv.revision;
    state.updatedAt = tv.updatedAt;
    state.songSessionId = tv.songSessionId ?? "";
    state.errorCode = tv.errorCode ?? "";
    state.errorMessage = tv.errorMessage ?? "";
    state.skipRequested = tv.skipRequested;
    state.canPrevious = tv.history.length > 0;
    state.memberCanAddSong = tv.permissions.memberCanAddSong;
    state.memberCanVoteSkip = tv.permissions.memberCanVoteSkip;
    state.memberCanControlPlayback = tv.permissions.memberCanControlPlayback;
    state.coHostCanControlPlayback = tv.permissions.coHostCanControlPlayback;
    state.hostOnlyCanClearQueue = tv.permissions.hostOnlyCanClearQueue;
    state.skipThreshold = tv.permissions.skipThreshold;
    state.autoSkipOnThreshold = tv.permissions.autoSkipOnThreshold;
    state.voteCooldownMs = tv.permissions.voteCooldownMs;
    state.voteDurationMs = tv.permissions.voteDurationMs;
    state.skipVoterIds.clear();
    for (const voter of tv.skipVotes) state.skipVoterIds.push(voter);
    state.queue.clear();
    for (const item of tv.queue) {
      const row = new QueueItemState();
      row.id = item.id;
      row.videoId = item.videoId;
      row.title = item.title;
      row.thumbnail = item.thumbnail;
      row.channelTitle = item.channelTitle;
      row.requestedBy = item.requestedBy;
      row.requestedByName = item.requestedByName;
      row.status = item.status;
      row.position = item.position;
      row.createdAt = item.createdAt;
      row.durationSec = item.durationSec ?? 0;
      state.queue.push(row);
    }
  }

  private memberRefs(): MemberRef[] {
    const members: MemberRef[] = [];
    this.state.players.forEach((player) => {
      members.push({
        userId: player.id,
        role: (player.role as RoomRole) || "member",
        displayName: player.name,
        joinedAt: player.joinedAt,
      });
    });
    return members;
  }

  private actor(client: Client): Actor {
    const auth = (client as SessionClient).auth;
    const player = this.state.players.get(auth.userId);
    return {
      userId: auth.userId,
      role: ((player?.role || auth.role) as RoomRole) || "member",
      displayName: player?.name || auth.displayName,
    };
  }

  private player(client: Client) {
    const auth = (client as SessionClient).auth;
    return auth ? this.state.players.get(auth.userId) : undefined;
  }

  private hitLimit(key: string, limit: number, windowMs: number): boolean {
    if (!roomBridge.allow) return false;
    return !roomBridge.allow(key, limit, windowMs);
  }

  private async reply(client: Client, requestId: string, result: EngineResult) {
    if (!result.ok) {
      client.send("tv:error", { requestId, code: result.error?.code, message: result.error?.message });
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function asBool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}
