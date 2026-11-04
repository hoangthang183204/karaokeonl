import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { errorMessage } from "@karaoke/shared";
import type { RoomRole } from "@karaoke/shared";
import { PrismaService } from "../prisma/prisma.service";

const MAX_PLAYERS = 50;

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(hostId: string, name: string) {
    const roomName = name.trim();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const id = randomBytes(4).toString("hex");
      try {
        const now = new Date();
        await this.prisma.$transaction([
          this.prisma.karaokeRoom.create({ data: { id, name: roomName, hostId } }),
          this.prisma.roomMember.create({ data: { roomId: id, userId: hostId, role: "host" } }),
          this.prisma.roomTvState.create({
            data: { roomId: id, hostId, playbackState: "idle", currentTime: 0, revision: 0, updatedAt: now },
          }),
          this.prisma.tvPermission.create({ data: { roomId: id } }),
        ]);
        return { id, name: roomName, hostId, role: "host" as const };
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== "P2002") throw error;
      }
    }
    throw new BadRequestException({ code: "invalid_request", message: "Không tạo được mã phòng. Hãy thử lại." });
  }

  async join(roomId: string, userId: string) {
    const room = await this.prisma.karaokeRoom.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException({ code: "room_not_found", message: errorMessage("room_not_found") });
    const existing = await this.prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId } } });
    if (existing) return this.summary(roomId, userId);
    const count = await this.prisma.roomMember.count({ where: { roomId } });
    if (count >= MAX_PLAYERS) {
      throw new BadRequestException({ code: "room_full", message: errorMessage("room_full") });
    }
    await this.prisma.roomMember.create({ data: { roomId, userId, role: "member" } });
    return this.summary(roomId, userId);
  }

  async summary(roomId: string, userId: string) {
    const member = await this.requireMember(roomId, userId);
    const room = await this.prisma.karaokeRoom.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException({ code: "room_not_found", message: errorMessage("room_not_found") });
    const members = await this.prisma.roomMember.findMany({
      where: { roomId },
      include: { user: true },
      orderBy: { joinedAt: "asc" },
    });
    return {
      id: room.id,
      name: room.name,
      hostId: room.hostId,
      role: member.role,
      members: members.map((item) => ({
        userId: item.userId,
        displayName: item.user.displayName,
        role: item.role,
        joinedAt: item.joinedAt.getTime(),
      })),
    };
  }

  async mine(userId: string) {
    const rows = await this.prisma.roomMember.findMany({
      where: { userId },
      include: { room: true },
      orderBy: { joinedAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.roomId,
      name: row.room.name,
      hostId: row.room.hostId,
      role: row.role,
      joinedAt: row.joinedAt.getTime(),
    }));
  }

  async requireMember(roomId: string, userId: string) {
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: { user: true, room: true },
    });
    if (!member) throw new NotFoundException({ code: "not_in_room", message: errorMessage("not_in_room") });
    return member;
  }

  async getMember(roomId: string, userId: string) {
    return this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: { user: true, room: true },
    });
  }

  async applyRoleChanges(input: {
    roomId: string;
    hostId?: string;
    updates?: { userId: string; role: RoomRole }[];
    removeUserId?: string;
  }) {
    await this.prisma.$transaction(async (tx) => {
      if (input.hostId) {
        await tx.karaokeRoom.update({ where: { id: input.roomId }, data: { hostId: input.hostId } });
        await tx.roomTvState.update({ where: { roomId: input.roomId }, data: { hostId: input.hostId } });
      }
      for (const update of input.updates ?? []) {
        await tx.roomMember.updateMany({
          where: { roomId: input.roomId, userId: update.userId },
          data: { role: update.role },
        });
      }
      if (input.removeUserId) {
        await tx.roomMember.deleteMany({ where: { roomId: input.roomId, userId: input.removeUserId } });
      }
    });
  }
}
