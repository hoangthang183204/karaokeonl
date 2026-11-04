import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import type { AuthPayload } from "../auth/jwt.strategy";
import { CreateRoomDto } from "./rooms.dto";
import { RoomsService } from "./rooms.service";

@Controller("rooms")
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Post()
  create(@Req() request: Request & { user: AuthPayload }, @Body() body: CreateRoomDto) {
    return this.rooms.create(request.user.sub, body.name);
  }

  @Get("mine")
  mine(@Req() request: Request & { user: AuthPayload }) {
    return this.rooms.mine(request.user.sub);
  }

  @Get(":roomId")
  get(@Req() request: Request & { user: AuthPayload }, @Param("roomId") roomId: string) {
    return this.rooms.summary(roomId, request.user.sub);
  }

  @Post(":roomId/join")
  join(@Req() request: Request & { user: AuthPayload }, @Param("roomId") roomId: string) {
    return this.rooms.join(roomId, request.user.sub);
  }
}
