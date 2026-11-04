export const DRINK = {
  crateCans: 24,
  drinkMs: 2200,
  openMs: 700,
  crateReach: 3,
  drunkLevelMax: 10,
  recoveryPerSecond: 0.08,
  sittingRecoveryMultiplier: 2,
  cameraSwayIntensity: 0.035,
  blurIntensity: 1.6,
  distortionIntensity: 0.012,
  animationBlendDuration: 0.35,
  maxPlacedCans: 8,
  dancerWorkMs: 30000,
  greetMs: 1200,
} as const;

export type DrunkTier = "normal" | "tipsy" | "drunk" | "very" | "max";

export function drunkTier(level: number): DrunkTier {
  if (level >= 7) return "max";
  if (level >= 5) return "very";
  if (level >= 3) return "drunk";
  if (level >= 1) return "tipsy";
  return "normal";
}

export function drunkVisual(level: number) {
  const clamped = Math.max(0, Math.min(DRINK.drunkLevelMax, level));
  const blend = Math.min(clamped / 7, 1);
  return {
    roll: DRINK.cameraSwayIntensity * blend,
    blur: DRINK.blurIntensity * blend,
    sway: DRINK.distortionIntensity * blend,
    vignette: 28 + 90 * blend,
  };
}
