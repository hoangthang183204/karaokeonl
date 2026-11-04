import { youtubePlayerError } from "@karaoke/shared";

export type PlayerStatus = "unready" | "unstarted" | "playing" | "paused" | "buffering" | "ended" | "cued";

type Listener = () => void;

let apiPromise: Promise<void> | null = null;

export const activePlayer: { current: YouTubePlayerService | null } = { current: null };

function loadApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no-window"));
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });
  return apiPromise;
}

function mapState(value: number): PlayerStatus {
  switch (value) {
    case 1:
      return "playing";
    case 2:
      return "paused";
    case 3:
      return "buffering";
    case 0:
      return "ended";
    case 5:
      return "cued";
    default:
      return "unstarted";
  }
}

export class YouTubePlayerService {
  private player: YTPlayer | null = null;
  private ready = false;
  private destroyed = false;
  private pending: { videoId: string; startSeconds: number; autoplay: boolean } | null = null;
  videoId: string | null = null;
  status: PlayerStatus = "unready";
  autoplayBlocked = false;
  errorText = "";
  private readonly listeners = new Set<Listener>();
  private wantPlay = false;
  private autoplayTimer = 0;
  private lastPlayAt = 0;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  async mount(element: HTMLElement) {
    await loadApi();
    if (this.destroyed || !window.YT) return;
    this.player = new window.YT.Player(element, {
      width: "100%",
      height: "100%",
      playerVars: {
        rel: 0,
        playsinline: 1,
        enablejsapi: 1,
        controls: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          this.ready = true;
          this.status = "unstarted";
          if (this.pending) {
            const next = this.pending;
            this.pending = null;
            this.load(next.videoId, next.startSeconds, next.autoplay);
          }
          this.emit();
        },
        onStateChange: (event) => {
          this.status = mapState(event.data);
          if (this.status === "playing") {
            window.clearTimeout(this.autoplayTimer);
            this.autoplayTimer = 0;
            this.autoplayBlocked = false;
            this.wantPlay = false;
          }
          this.emit();
        },
        onError: (event) => {
          const mapped = youtubePlayerError(event.data);
          this.errorText = mapped.message;
          this.status = "paused";
          this.emit();
        },
      },
    });
  }

  load(videoId: string, startSeconds: number, autoplay: boolean) {
    this.videoId = videoId;
    this.errorText = "";
    this.wantPlay = autoplay;
    this.autoplayBlocked = false;
    if (autoplay) this.armAutoplayCheck();
    if (!this.player || !this.ready) {
      this.pending = { videoId, startSeconds, autoplay };
      return;
    }
    const options = { videoId, startSeconds: Math.max(0, startSeconds) };
    const method = autoplay ? "loadVideoById" : "cueVideoById";
    const player = this.player as unknown as Record<string, (...params: unknown[]) => unknown>;
    if (typeof player[method] !== "function") {
      this.pending = { videoId, startSeconds, autoplay };
      return;
    }
    try {
      player[method](options);
    } catch {
      this.pending = { videoId, startSeconds, autoplay };
    }
  }

  play(fromUser = false) {
    this.wantPlay = true;
    const now = Date.now();
    if (!fromUser && now - this.lastPlayAt < 2000) {
      this.armAutoplayCheck();
      return;
    }
    this.lastPlayAt = now;
    this.autoplayBlocked = false;
    this.invoke("playVideo");
    this.armAutoplayCheck();
  }

  pause() {
    this.wantPlay = false;
    this.invoke("pauseVideo");
  }

  seek(seconds: number) {
    this.invoke("seekTo", Math.max(0, seconds), true);
  }

  setVolume(volume: number) {
    this.invoke("setVolume", Math.max(0, Math.min(100, Math.round(volume))));
  }

  mute() {
    this.invoke("mute");
  }

  unmute() {
    this.invoke("unMute");
  }

  isMuted() {
    return this.invoke("isMuted") === true;
  }

  getCurrentTime() {
    const value = this.invoke("getCurrentTime");
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }

  getDuration() {
    const value = this.invoke("getDuration");
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }

  stop() {
    this.videoId = null;
    this.wantPlay = false;
    this.pending = null;
    this.invoke("stopVideo");
  }

  private armAutoplayCheck() {
    if (this.autoplayTimer) return;
    this.autoplayTimer = window.setTimeout(() => {
      this.autoplayTimer = 0;
      if (this.destroyed || !this.wantPlay) return;
      if (this.status === "playing" || this.status === "buffering") return;
      this.autoplayBlocked = true;
      this.emit();
    }, 1500);
  }

  private invoke(method: string, ...args: unknown[]) {
    const player = this.player as unknown as Record<string, (...params: unknown[]) => unknown> | null;
    const fn = player?.[method];
    if (!this.ready || typeof fn !== "function") return undefined;
    try {
      return fn.apply(player, args);
    } catch {
      return undefined;
    }
  }

  destroy() {
    this.destroyed = true;
    window.clearTimeout(this.autoplayTimer);
    this.pending = null;
    try {
      this.player?.destroy();
    } catch {
      // Iframe có thể đã bị gỡ khi React unmount.
    }
    this.player = null;
    this.ready = false;
    this.listeners.clear();
  }
}
