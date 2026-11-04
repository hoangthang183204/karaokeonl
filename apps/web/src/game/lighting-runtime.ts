import { DEFAULT_LIGHTING, type LightingState } from "@karaoke/shared";

export const lightingLive: LightingState & { reduceMotion: boolean } = {
  ...DEFAULT_LIGHTING,
  reduceMotion: false,
};

export function applyLighting(next: Partial<LightingState> & { reduceMotion?: boolean }) {
  Object.assign(lightingLive, next);
  window.dispatchEvent(new CustomEvent("karaoke-lights"));
}
