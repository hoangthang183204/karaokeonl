import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { defaultAvatar, sanitizeAvatar } from "@karaoke/shared";
import bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthPayload } from "./jwt.strategy";
import type { SaveAvatarDto } from "./auth.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: { email: string; displayName: string; password: string }) {
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException({ code: "email_taken", message: "Email này đã được đăng ký." });
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.prisma.user.create({ data: { email, displayName, passwordHash } });
    return this.issue(user.id, user.email, user.displayName);
  }

  async login(input: { email: string; password: string }) {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException({ code: "unauthenticated", message: "Email hoặc mật khẩu không đúng." });
    const matches = await bcrypt.compare(input.password, user.passwordHash);
    if (!matches) throw new UnauthorizedException({ code: "unauthenticated", message: "Email hoặc mật khẩu không đúng." });
    return this.issue(user.id, user.email, user.displayName);
  }

  async getAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.avatarCreated) {
      return { userId, ...defaultAvatar("male"), isCreated: false };
    }
    return {
      userId,
      gender: user.gender,
      skinColor: user.skinColor,
      hairColor: user.hairColor,
      outfitColor: user.outfitColor,
      avatarModel: user.avatarModel,
      outfit: user.outfit,
      isCreated: true,
    };
  }

  async saveAvatar(userId: string, input: SaveAvatarDto) {
    const clean = sanitizeAvatar(input);
    if (!clean) throw new BadRequestException({ code: "invalid_request", message: "Ngoại hình không hợp lệ." });
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        gender: clean.gender,
        skinColor: clean.skinColor,
        hairColor: clean.hairColor,
        outfitColor: clean.outfitColor,
        avatarModel: clean.avatarModel,
        outfit: clean.outfit,
        avatarCreated: true,
      },
    });
    return { userId, ...clean, isCreated: true };
  }

  private issue(sub: string, email: string, displayName: string) {
    const payload: AuthPayload = { sub, email, displayName };
    return {
      token: this.jwt.sign(payload),
      user: { id: sub, email, displayName },
    };
  }
}
