import { Module } from "@nestjs/common";
import { RoomsModule } from "../rooms/rooms.module";
import { YoutubeModule } from "../youtube/youtube.module";
import { TvController } from "./tv.controller";
import { TvRepository } from "./tv.repository";
import { TvService } from "./tv.service";

@Module({
  imports: [RoomsModule, YoutubeModule],
  controllers: [TvController],
  providers: [TvRepository, TvService],
  exports: [TvService, TvRepository],
})
export class TvModule {}
