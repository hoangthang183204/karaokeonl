import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import {
  applyVideoDetails,
  classifyYoutubeApiError,
  errorMessage,
  mapOEmbed,
  mapSearchItems,
  mapVideoDetails,
  parseYouTubeVideoId,
  resolvedFromDetail,
  type ResolvedVideo,
  type SearchHit,
} from "@karaoke/shared";

interface CacheEntry {
  at: number;
  hits: SearchHit[];
}

@Injectable()
export class YoutubeService {
  private readonly cache = new Map<string, CacheEntry>();

  configured(): boolean {
    return Boolean(process.env.YOUTUBE_API_KEY?.trim());
  }

  async resolve(input: string): Promise<ResolvedVideo> {
    const videoId = parseYouTubeVideoId(input);
    if (!videoId) {
      throw new BadRequestException({ code: "invalid_video", message: errorMessage("invalid_video") });
    }

    const key = process.env.YOUTUBE_API_KEY?.trim();
    if (key) {
      const fromApi = await this.lookupWithDataApi(key, videoId);
      if (fromApi) return fromApi;
    }
    return this.lookupWithOEmbed(videoId);
  }

  async search(query: string): Promise<{ configured: boolean; results: SearchHit[]; message?: string }> {
    const key = process.env.YOUTUBE_API_KEY?.trim();
    const text = query.trim();
    if (!text) return { configured: Boolean(key), results: [], message: errorMessage("search_empty") };
    if (!key) {
      return { configured: false, results: [], message: errorMessage("search_unconfigured") };
    }

    const cacheKey = text.toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.at < 10 * 60 * 1000) {
      return { configured: true, results: cached.hits };
    }

    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("videoEmbeddable", "true");
    searchUrl.searchParams.set("maxResults", "8");
    searchUrl.searchParams.set("q", text);
    searchUrl.searchParams.set("key", key);

    const searchPayload = await this.getJson(searchUrl);
    const quota = classifyYoutubeApiError(searchPayload);
    if (quota?.kind === "quota") {
      throw new ServiceUnavailableException({ code: "quota_exceeded", message: errorMessage("quota_exceeded") });
    }
    if (quota) {
      throw new BadRequestException({ code: "metadata_unavailable", message: errorMessage("metadata_unavailable") });
    }

    let hits = mapSearchItems(searchPayload);
    if (hits.length > 0) {
      const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      detailsUrl.searchParams.set("part", "contentDetails,status");
      detailsUrl.searchParams.set("id", hits.map((hit) => hit.videoId).join(","));
      detailsUrl.searchParams.set("key", key);
      const detailsPayload = await this.getJson(detailsUrl);
      const detailError = classifyYoutubeApiError(detailsPayload);
      if (detailError?.kind === "quota") {
        throw new ServiceUnavailableException({ code: "quota_exceeded", message: errorMessage("quota_exceeded") });
      }
      if (!detailError) hits = applyVideoDetails(hits, mapVideoDetails(detailsPayload));
    }

    this.remember(cacheKey, hits);
    return {
      configured: true,
      results: hits,
      message: hits.length === 0 ? errorMessage("search_empty") : undefined,
    };
  }

  private async lookupWithDataApi(key: string, videoId: string): Promise<ResolvedVideo | null> {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,contentDetails,status");
    url.searchParams.set("id", videoId);
    url.searchParams.set("key", key);
    const payload = await this.getJson(url);
    const apiError = classifyYoutubeApiError(payload);
    if (apiError?.kind === "quota") return null;
    if (apiError) {
      throw new BadRequestException({ code: "metadata_unavailable", message: errorMessage("metadata_unavailable") });
    }
    const items = (payload as { items?: unknown[] }).items ?? [];
    const item = items[0] as Parameters<typeof resolvedFromDetail>[1];
    const resolved = resolvedFromDetail(videoId, item);
    if (!resolved) {
      throw new BadRequestException({ code: "video_unavailable", message: errorMessage("video_unavailable") });
    }
    return resolved;
  }

  private async lookupWithOEmbed(videoId: string): Promise<ResolvedVideo> {
    const page = `https://www.youtube.com/watch?v=${videoId}`;
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(page)}&format=json`;
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    } catch {
      throw new BadRequestException({ code: "metadata_unavailable", message: errorMessage("metadata_unavailable") });
    }
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      throw new BadRequestException({ code: "video_unavailable", message: errorMessage("video_unavailable") });
    }
    if (!response.ok) {
      throw new BadRequestException({ code: "metadata_unavailable", message: errorMessage("metadata_unavailable") });
    }
    const mapped = mapOEmbed(videoId, await response.json());
    if (!mapped) {
      throw new BadRequestException({ code: "metadata_unavailable", message: errorMessage("metadata_unavailable") });
    }
    return mapped;
  }

  private async getJson(url: URL): Promise<unknown> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      return await response.json();
    } catch {
      throw new BadRequestException({ code: "metadata_unavailable", message: errorMessage("metadata_unavailable") });
    }
  }

  private remember(key: string, hits: SearchHit[]) {
    this.cache.set(key, { at: Date.now(), hits });
    if (this.cache.size > 100) {
      const oldest = [...this.cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) this.cache.delete(oldest[0]);
    }
  }
}
