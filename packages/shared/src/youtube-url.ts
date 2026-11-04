const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;

const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
]);

export function isValidYouTubeVideoId(value: string | null | undefined): value is string {
  return typeof value === "string" && VIDEO_ID.test(value);
}

export function parseYouTubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > 400) return null;
  if (VIDEO_ID.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!ALLOWED_HOSTS.has(host)) return null;

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return isValidYouTubeVideoId(id) ? id : null;
  }

  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v");
    return isValidYouTubeVideoId(id) ? id : null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const head = parts[0];
  if (head === "embed" || head === "shorts" || head === "live" || head === "v") {
    const id = parts[1] ?? "";
    return isValidYouTubeVideoId(id) ? id : null;
  }

  return null;
}

const THUMB_HOSTS = new Set(["i.ytimg.com", "i9.ytimg.com", "img.youtube.com"]);

export function isAllowedThumbnailUrl(value: string): boolean {
  if (!value) return true;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (THUMB_HOSTS.has(host)) return true;
  if (host.endsWith(".ggpht.com")) return true;
  if (host.endsWith(".googleusercontent.com")) return true;
  return false;
}

export function cleanMetadataText(value: string, max: number): string {
  return value
    .replace(/[\u0000-\u001F<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
