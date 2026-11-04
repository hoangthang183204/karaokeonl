export const LIGHT_MODES = ["normal", "chill", "party", "disco", "dance-show", "static", "pulse", "rainbow", "music-reactive", "off"] as const;
export type LightMode = (typeof LIGHT_MODES)[number];
export const COLOR_STYLES = ["fixed", "cycle", "random"] as const;
export type ColorStyle = (typeof COLOR_STYLES)[number];
export const SPOT_TARGETS = ["stage", "dancer"] as const;
export type SpotTarget = (typeof SPOT_TARGETS)[number];

export interface LightingState {
  enabled: boolean;
  brightness: number;
  flashSpeed: number;
  color: string;
  secondaryColor: string;
  effectMode: LightMode;
  spotlightIntensity: number;
  ambientIntensity: number;
  strobe: boolean;
  colorStyle: ColorStyle;
  spotTarget: SpotTarget;
  autoDance: boolean;
  startedAt: number;
  revision: number;
}

export const FLASH_MIN = 0.25;
export const FLASH_MAX = 2;
export const LIGHT_PALETTE = ["#a855f7", "#3b82f6", "#f472b6", "#fb7185", "#34d399", "#22d3ee"] as const;
export const CHILL_PALETTE = ["#a855f7", "#3b82f6", "#f472b6"] as const;

export const DEFAULT_LIGHTING: LightingState = {
  enabled: true,
  brightness: 0.72,
  flashSpeed: 0.6,
  color: "#c084fc",
  secondaryColor: "#22d3ee",
  effectMode: "pulse",
  spotlightIntensity: 0.7,
  ambientIntensity: 0.45,
  strobe: false,
  colorStyle: "fixed",
  spotTarget: "stage",
  autoDance: true,
  startedAt: 0,
  revision: 0,
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export function sanitizeLighting(input: Partial<LightingState>, revision: number): LightingState {
  const mode = LIGHT_MODES.includes(input.effectMode as LightMode) ? (input.effectMode as LightMode) : DEFAULT_LIGHTING.effectMode;
  return {
    enabled: input.enabled !== false,
    brightness: clamp01(input.brightness, DEFAULT_LIGHTING.brightness),
    flashSpeed: clamp(input.flashSpeed, FLASH_MIN, FLASH_MAX, DEFAULT_LIGHTING.flashSpeed),
    color: HEX.test(input.color ?? "") ? input.color! : DEFAULT_LIGHTING.color,
    secondaryColor: HEX.test(input.secondaryColor ?? "") ? input.secondaryColor! : DEFAULT_LIGHTING.secondaryColor,
    effectMode: mode,
    spotlightIntensity: clamp01(input.spotlightIntensity, DEFAULT_LIGHTING.spotlightIntensity),
    ambientIntensity: clamp01(input.ambientIntensity, DEFAULT_LIGHTING.ambientIntensity),
    strobe: input.strobe === true,
    colorStyle: COLOR_STYLES.includes(input.colorStyle as ColorStyle) ? (input.colorStyle as ColorStyle) : "fixed",
    spotTarget: input.spotTarget === "dancer" ? "dancer" : "stage",
    autoDance: input.autoDance !== false,
    startedAt: typeof input.startedAt === "number" && Number.isFinite(input.startedAt) ? input.startedAt : 0,
    revision,
  };
}

export interface LightFrame {
  primary: string;
  secondary: string;
  pulse: number;
  blink: number;
  strobe: number;
  spotYaw: number;
  lasers: boolean;
  floor: number;
  mode: string;
}

export function lightSample(state: LightingState, now: number, reduced: boolean): LightFrame {
  const inactive = !state.enabled || state.effectMode === "off" || state.effectMode === "music-reactive";
  const mode = inactive ? "static" : state.effectMode;
  const origin = state.startedAt > 0 ? state.startedAt : now;
  const elapsed = Math.max(0, (now - origin) / 1000);
  const speed = Math.min(FLASH_MAX, reduced ? Math.min(state.flashSpeed, 0.35) : state.flashSpeed);
  const calm = mode === "static" || mode === "normal" || mode === "chill";
  const palette = mode === "chill" ? CHILL_PALETTE : LIGHT_PALETTE;
  const wantsColor = state.colorStyle !== "fixed" || mode === "chill" || mode === "disco" || mode === "party" || mode === "rainbow" || mode === "dance-show";
  let primary = state.color;
  let secondary = state.secondaryColor;
  if (wantsColor && !inactive) {
    const period = reduced || mode === "chill" || mode === "dance-show" ? 5 : Math.max(1.4, 2.2 / Math.max(speed, 0.25));
    const pos = elapsed / period;
    const slot = Math.floor(pos);
    const blend = smooth(pos - slot);
    const index = state.colorStyle === "random" && mode !== "chill" ? Math.floor(hash(slot) * palette.length) : slot % palette.length;
    const next = state.colorStyle === "random" && mode !== "chill" ? Math.floor(hash(slot + 1) * palette.length) : (index + 1) % palette.length;
    primary = mixHex(palette[index % palette.length], palette[next % palette.length], blend);
    secondary = mixHex(palette[(index + 2) % palette.length], palette[(next + 2) % palette.length], blend);
  }
  const flashing = !reduced && !calm && !inactive && mode !== "dance-show";
  const beat = Math.max(speed, mode === "disco" || mode === "party" ? 1.5 : speed);
  const blink = flashing ? (Math.sin(elapsed * beat * Math.PI * 2) > 0 ? 1 : 0) : 1;
  const pulse = flashing ? 0.32 + blink : 1;
  const strobeOn = state.strobe && flashing;
  const strobe = strobeOn ? (Math.sin(elapsed * beat * Math.PI * 2) > 0.15 ? 1 : 0.45) : 1;
  const spotYaw = reduced || calm ? Math.sin(elapsed * 0.2) * 0.15 : Math.sin(elapsed * (mode === "disco" ? 0.7 : 0.35) * Math.PI) * 0.55;
  return {
    primary,
    secondary,
    pulse,
    blink,
    strobe,
    spotYaw,
    lasers: mode === "disco" && !reduced && !inactive,
    floor: mode === "party" || mode === "disco" ? 1.35 : mode === "dance-show" ? 0.55 : 0.75,
    mode,
  };
}

export interface DanceLightHold {
  mode: LightMode;
  spotTarget: SpotTarget;
}

export function stepDanceLight(state: LightingState, hold: DanceLightHold | null, performing: boolean): { state: LightingState; hold: DanceLightHold | null; changed: boolean } {
  if (!state.autoDance) {
    if (!hold) return { state, hold: null, changed: false };
    return { state: { ...state, effectMode: hold.mode, spotTarget: hold.spotTarget }, hold: null, changed: true };
  }
  if (performing && !hold) {
    const changed = state.effectMode !== "dance-show" || state.spotTarget !== "dancer";
    return {
      state: { ...state, effectMode: "dance-show", spotTarget: "dancer" },
      hold: { mode: state.effectMode, spotTarget: state.spotTarget },
      changed,
    };
  }
  if (!performing && hold) {
    return { state: { ...state, effectMode: hold.mode, spotTarget: hold.spotTarget }, hold: null, changed: true };
  }
  return { state, hold, changed: false };
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function mixHex(a: string, b: string, t: number) {
  const channel = (start: number) => {
    const from = Number.parseInt(a.slice(start, start + 2), 16);
    const to = Number.parseInt(b.slice(start, start + 2), 16);
    return Math.round(from + (to - from) * t).toString(16).padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

function clamp01(value: number | undefined, fallback: number): number {
  return clamp(value, 0, 1, fallback);
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
