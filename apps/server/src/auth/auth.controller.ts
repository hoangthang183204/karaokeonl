import { BadRequestException, Body, Controller, Get, Put, Req, Post, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { LoginDto, RegisterDto, SaveAvatarDto } from "./auth.dto";
import { JwtAuthGuard } from "./jwt.guard";
import type { AuthPayload } from "./jwt.strategy";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() body: RegisterDto) {
    return this.auth.register(body);
  }

  @Post("login")
  login(@Body() body: LoginDto) {
    return this.auth.login(body);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() request: Request & { user: AuthPayload }) {
    return { id: request.user.sub, email: request.user.email, displayName: request.user.displayName };
  }

  @Get("avatar")
  @UseGuards(JwtAuthGuard)
  avatar(@Req() request: Request & { user: AuthPayload }) {
    return this.auth.getAvatar(request.user.sub);
  }

  @Put("avatar")
  @UseGuards(JwtAuthGuard)
  saveAvatar(@Req() request: Request & { user: AuthPayload }, @Body() body: SaveAvatarDto) {
    if (!body) throw new BadRequestException({ code: "invalid_request", message: "Thiếu ngoại hình." });
    return this.auth.saveAvatar(request.user.sub, body);
  }
}
