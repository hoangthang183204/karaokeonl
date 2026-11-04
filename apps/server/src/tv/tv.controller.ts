import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import type { AuthPayload } from "../auth/jwt.strategy";
import { NextDto, PermissionsDto, RevisionQueryDto, SearchDto, VideoCommandDto } from "./tv.dto";
import { TvService } from "./tv.service";

@Controller("rooms/:roomId/tv")
@UseGuards(JwtAuthGuard)
export class TvController {
  constructor(private readonly tv: TvService) {}

  @Get()
  get(@Req() request: Request & { user: AuthPayload }, @Param("roomId") roomId: string) {
    return this.tv.snapshot(roomId, request.user.sub);
  }

  @Get("queue")
  queue(@Req() request: Request & { user: AuthPayload }, @Param("roomId") roomId: string) {
    return this.tv.queue(roomId, request.user.sub);
  }

  @Get("permissions")
  permissions(@Req() request: Request & { user: AuthPayload }, @Param("roomId") roomId: string) {
    return this.tv.permissions(roomId, request.user.sub);
  }

  @Post("search")
  search(@Req() request: Request & { user: AuthPayload }, @Param("roomId") roomId: string, @Body() body: SearchDto) {
    return this.tv.search(roomId, request.user.sub, body.query);
  }

  @Post("add-song")
  add(@Req() request: Request & { user: AuthPayload }, @Param("roomId") roomId: string, @Body() body: VideoCommandDto) {
    return this.tv.addSong(roomId, request.user.sub, body);
  }

  @Post("play-now")
  play(@Req() request: Request & { user: AuthPayload }, @Param("roomId") roomId: string, @Body() body: VideoCommandDto) {
    return this.tv.playNow(roomId, request.user.sub, body);
  }

  @Post("next")
  next(@Req() request: Request & { user: AuthPayload }, @Param("roomId") roomId: string, @Body() body: NextDto) {
    return this.tv.next(roomId, request.user.sub, body.requestId, body.expectedRevision);
  }

  @Post("skip-vote")
  vote(@Req() request: Request & { user: AuthPayload }, @Param("roomId") roomId: string, @Body() body: NextDto) {
    return this.tv.skipVote(roomId, request.user.sub, body.requestId, body.expectedRevision);
  }

  @Patch("permissions")
  patchPermissions(@Req() request: Request & { user: AuthPayload }, @Param("roomId") roomId: string, @Body() body: PermissionsDto) {
    return this.tv.updatePermissions(roomId, request.user.sub, body);
  }

  @Delete("queue/:songId")
  remove(
    @Req() request: Request & { user: AuthPayload },
    @Param("roomId") roomId: string,
    @Param("songId") songId: string,
    @Query() query: RevisionQueryDto,
  ) {
    return this.tv.remove(roomId, request.user.sub, songId, query.requestId, query.expectedRevision);
  }

  @Delete("queue")
  clear(@Req() request: Request & { user: AuthPayload }, @Param("roomId") roomId: string, @Query() query: RevisionQueryDto) {
    return this.tv.clear(roomId, request.user.sub, query.requestId, query.expectedRevision);
  }
}
