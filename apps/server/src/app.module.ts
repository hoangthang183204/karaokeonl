import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { HealthController } from "./health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { RoomsModule } from "./rooms/rooms.module";
import { TvModule } from "./tv/tv.module";
import { VoiceModule } from "./voice/voice.module";
import { YoutubeModule } from "./youtube/youtube.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] }),
    PrismaModule,
    AuthModule,
    RoomsModule,
    YoutubeModule,
    TvModule,
    VoiceModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
