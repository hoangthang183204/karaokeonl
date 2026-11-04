import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { AccessToken } from "livekit-server-sdk";
import { errorMessage } from "@karaoke/shared";
import { RoomsService } from "../rooms/rooms.service";

@Injectable()
export class VoiceService {
  constructor(private readonly rooms: RoomsService) {}

  async token(roomId: string, userId: string, displayName: string) {
    await this.rooms.requireMember(roomId, userId);
    const apiKey = process.env.LIVEKIT_API_KEY?.trim();
    const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
    const url = process.env.LIVEKIT_URL?.trim();
    if (!apiKey || !apiSecret || !url) {
      throw new ServiceUnavailableException({ code: "voice_unconfigured", message: errorMessage("voice_unconfigured") });
    }
    const token = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: displayName,
      ttl: "2h",
    });
    token.addGrant({
      roomJoin: true,
      room: `karaoke-${roomId}`,
      canPublish: true,
      canSubscribe: true,
    });
    return { url, token: await token.toJwt() };
  }
}
