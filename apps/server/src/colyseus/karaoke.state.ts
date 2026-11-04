// Schema này phụ thuộc useDefineForClassFields: false trong tsconfig server.
import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

export class QueueItemState extends Schema {
  @type("string") id: string = "";
  @type("string") videoId: string = "";
  @type("string") title: string = "";
  @type("string") thumbnail: string = "";
  @type("string") channelTitle: string = "";
  @type("string") requestedBy: string = "";
  @type("string") requestedByName: string = "";
  @type("string") status: string = "waiting";
  @type("number") position: number = 0;
  @type("number") createdAt: number = 0;
  @type("number") durationSec: number = 0;
}

export class PlayerState extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("string") role: string = "member";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") z: number = 3;
  @type("number") rot: number = 0;
  @type("string") motion: string = "idle";
  @type("boolean") seated: boolean = false;
  @type("boolean") singing: boolean = false;
  @type("string") seatId: string = "";
  @type("string") outfit: string = "hoodie";
  @type("string") emote: string = "";
  @type("number") emoteUntil: number = 0;
  @type("string") color: string = "#c084fc";
  @type("string") gender: string = "";
  @type("string") skinColor: string = "";
  @type("string") hairColor: string = "";
  @type("string") avatarModel: string = "";
  @type("number") joinedAt: number = 0;
  @type("number") movedAt: number = 0;
  @type("string") hand: string = "";
  @type("number") handUntil: number = 0;
  @type("number") drunkLevel: number = 0;
  @type("number") cansDrunk: number = 0;
  @type("number") hp: number = 100;
  @type("string") hpState: string = "normal";
  @type("string") combat: string = "";
  @type("number") combatUntil: number = 0;
  @type("number") downUntil: number = 0;
  @type("number") recoverUntil: number = 0;
  @type("number") cooldownUntil: number = 0;
}

export class NpcState extends Schema {
  @type("string") id: string = "";
  @type("string") role: string = "server";
  @type("string") service: string = "";
  @type("string") phase: string = "walk";
  @type("string") label: string = "";
  @type("number") x: number = 0;
  @type("number") z: number = 0;
  @type("number") rot: number = 0;
  @type("string") ownerId: string = "";
  @type("string") requestId: string = "";
  @type("string") spot: string = "";
  @type("string") style: string = "";
  @type("boolean") paused: boolean = false;
}

export class PropState extends Schema {
  @type("string") id: string = "";
  @type("string") kind: string = "";
  @type("number") x: number = 0;
  @type("number") z: number = 0;
  @type("number") remaining: number = 0;
  @type("string") ownerId: string = "";
  @type("string") status: string = "";
  @type("string") tableId: string = "";
}

export class OrderState extends Schema {
  @type("string") id: string = "";
  @type("string") playerId: string = "";
  @type("string") service: string = "";
  @type("string") status: string = "pending";
  @type("string") spot: string = "";
  @type("string") style: string = "";
  @type("number") createdAt: number = 0;
}

export class ChatState extends Schema {
  @type("string") id: string = "";
  @type("string") userId: string = "";
  @type("string") name: string = "";
  @type("string") text: string = "";
  @type("number") at: number = 0;
}

export class KaraokeState extends Schema {
  @type("string") roomId: string = "";
  @type("string") roomName: string = "";
  @type("string") hostId: string = "";
  @type("string") currentVideoId: string = "";
  @type("string") currentSongTitle: string = "";
  @type("string") currentThumbnail: string = "";
  @type("string") currentChannelTitle: string = "";
  @type("string") currentSongId: string = "";
  @type("string") currentRequestedByName: string = "";
  @type("string") playbackState: string = "idle";
  @type("number") anchorTime: number = 0;
  @type("number") duration: number = 0;
  @type("number") revision: number = 0;
  @type("number") updatedAt: number = 0;
  @type("string") songSessionId: string = "";
  @type("string") errorCode: string = "";
  @type("string") errorMessage: string = "";
  @type("boolean") skipRequested: boolean = false;
  @type("boolean") canPrevious: boolean = false;
  @type("boolean") memberCanAddSong: boolean = true;
  @type("boolean") memberCanVoteSkip: boolean = true;
  @type("boolean") memberCanControlPlayback: boolean = false;
  @type("boolean") coHostCanControlPlayback: boolean = true;
  @type("boolean") hostOnlyCanClearQueue: boolean = true;
  @type("number") skipThreshold: number = 2;
  @type("boolean") autoSkipOnThreshold: boolean = false;
  @type("number") voteCooldownMs: number = 5000;
  @type("number") voteDurationMs: number = 60000;
  @type("boolean") lightEnabled: boolean = true;
  @type("number") lightBrightness: number = 0.72;
  @type("number") lightFlashSpeed: number = 0.6;
  @type("string") lightColor: string = "#c084fc";
  @type("string") lightSecondaryColor: string = "#22d3ee";
  @type("string") lightMode: string = "pulse";
  @type("number") lightSpotlight: number = 0.7;
  @type("number") lightAmbient: number = 0.45;
  @type("boolean") lightStrobe: boolean = false;
  @type("string") lightColorStyle: string = "fixed";
  @type("string") lightSpotTarget: string = "stage";
  @type("boolean") lightAutoDance: boolean = true;
  @type("boolean") pvpEnabled: boolean = true;
  @type("number") lightStartedAt: number = 0;
  @type("number") lightRevision: number = 0;
  @type(["string"]) skipVoterIds = new ArraySchema<string>();
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type([QueueItemState]) queue = new ArraySchema<QueueItemState>();
  @type([ChatState]) chats = new ArraySchema<ChatState>();
  @type({ map: NpcState }) npcs = new MapSchema<NpcState>();
  @type({ map: PropState }) props = new MapSchema<PropState>();
  @type({ map: OrderState }) orders = new MapSchema<OrderState>();
}
