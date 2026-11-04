import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  health() {
    return {
      ok: true,
      service: "karaoke-online",
      youtubeSearch: Boolean(process.env.YOUTUBE_API_KEY?.trim()),
      livekit: Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET),
    };
  }
}
