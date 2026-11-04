import { Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import type { AuthPayload } from "../auth/jwt.strategy";
import { VoiceService } from "./voice.service";

@Controller("rooms/:roomId/voice")
@UseGuards(JwtAuthGuard)
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

  @Post("token")
  token(@Req() request: Request & { user: AuthPayload }, @Param("roomId") roomId: string) {
    return this.voice.token(roomId, request.user.sub, request.user.displayName);
  }
}
