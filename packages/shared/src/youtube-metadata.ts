import { LIMITS, type ResolvedVideo } from "./types";
import { cleanMetadataText, isAllowedThumbnailUrl, isValidYouTubeVideoId } from "./youtube-url";

export function parseIso8601Duration(value: string): number | null {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  if (!Number.isFinite(total) || total <= 0 || total > LIMITS.maxVideoHours * 3600) return null;
  return total;
}

interface Thumbnails {
  high?: { url?: string };
  medium?: { url?: string };
  default?: { url?: string };
}

function pickThumbnail(thumbnails: Thumbnails | undefined, videoId: string): string {
  const candidate =
    thumbnails?.high?.url ||
    thumbnails?.medium?.url ||
    thumbnails?.default?.url ||
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return isAllowedThumbnailUrl(candidate) ? candidate : "";
}

export function mapOEmbed(videoId: string, payload: unknown): ResolvedVideo | null {
  if (!isValidYouTubeVideoId(videoId) || !payload || typeof payload !== "object") return null;
  const data = payload as { title?: unknown; author_name?: unknown; thumbnail_url?: unknown };
  if (typeof data.title !== "string" || !data.title.trim()) return null;
  const thumbnail = typeof data.thumbnail_url === "string" ? data.thumbnail_url : "";
  if (thumbnail && !isAllowedThumbnailUrl(thumbnail)) return null;
  const title = cleanMetadataText(data.title, LIMITS.maxTitle);
  if (!title) return null;
  return {
    videoId,
    title,
    thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    channelTitle: cleanMetadataText(typeof data.author_name === "string" ? data.author_name : "", LIMITS.maxChannel),
    durationSec: null,
  };
}

export interface YoutubeApiErrorInfo {
  kind: "quota" | "forbidden" | "invalid" | "unknown";
  message: string;
}

export function classifyYoutubeApiError(payload: unknown): YoutubeApiErrorInfo | null {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return null;
  const error = (payload as { error?: { code?: number; message?: string; errors?: { reason?: string }[] } }).error;
  const reason = error?.errors?.[0]?.reason ?? "";
  const message = error?.message ?? "YouTube API error";
  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded" || error?.code === 403 && /quota/i.test(message)) {
    return { kind: "quota", message };
  }
  if (error?.code === 403) return { kind: "forbidden", message };
  if (error?.code === 400) return { kind: "invalid", message };
  return { kind: "unknown", message };
}

interface SearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: Thumbnails;
  };
}

interface VideoItem {
  id?: string;
  snippet?: SearchItem["snippet"];
  contentDetails?: { duration?: string };
  status?: { embeddable?: boolean; privacyStatus?: string };
}

export interface SearchHit {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  durationSec: number | null;
  embeddable: boolean;
}

export function mapSearchItems(payload: unknown): SearchHit[] {
  if (!payload || typeof payload !== "object" || !("items" in payload)) return [];
  const items = (payload as { items?: SearchItem[] }).items ?? [];
  const hits: SearchHit[] = [];
  for (const item of items) {
    const videoId = item.id?.videoId;
    const title = item.snippet?.title;
    if (!isValidYouTubeVideoId(videoId) || typeof title !== "string") continue;
    const cleaned = cleanMetadataText(title, LIMITS.maxTitle);
    if (!cleaned) continue;
    hits.push({
      videoId,
      title: cleaned,
      channelTitle: cleanMetadataText(item.snippet?.channelTitle ?? "", LIMITS.maxChannel),
      thumbnail: pickThumbnail(item.snippet?.thumbnails, videoId),
      durationSec: null,
      embeddable: true,
    });
  }
  return hits;
}

export function mapVideoDetails(payload: unknown): Map<string, { durationSec: number | null; embeddable: boolean; privacyStatus: string }> {
  const map = new Map<string, { durationSec: number | null; embeddable: boolean; privacyStatus: string }>();
  if (!payload || typeof payload !== "object" || !("items" in payload)) return map;
  for (const item of (payload as { items?: VideoItem[] }).items ?? []) {
    if (!isValidYouTubeVideoId(item.id)) continue;
    map.set(item.id, {
      durationSec: item.contentDetails?.duration ? parseIso8601Duration(item.contentDetails.duration) : null,
      embeddable: item.status?.embeddable !== false,
      privacyStatus: item.status?.privacyStatus ?? "unknown",
    });
  }
  return map;
}

export function applyVideoDetails(hits: SearchHit[], details: Map<string, { durationSec: number | null; embeddable: boolean }>): SearchHit[] {
  return hits.flatMap((hit) => {
    const detail = details.get(hit.videoId);
    if (detail && !detail.embeddable) return [];
    return [{
      ...hit,
      durationSec: detail?.durationSec ?? hit.durationSec,
      embeddable: detail?.embeddable ?? true,
    }];
  });
}

export function resolvedFromDetail(videoId: string, item: VideoItem | undefined): ResolvedVideo | null {
  if (!item?.snippet?.title || item.status?.embeddable === false) return null;
  if (item.status?.privacyStatus === "private") return null;
  const title = cleanMetadataText(item.snippet.title, LIMITS.maxTitle);
  if (!title) return null;
  return {
    videoId,
    title,
    thumbnail: pickThumbnail(item.snippet.thumbnails, videoId),
    channelTitle: cleanMetadataText(item.snippet.channelTitle ?? "", LIMITS.maxChannel),
    durationSec: item.contentDetails?.duration ? parseIso8601Duration(item.contentDetails.duration) : null,
  };
}
