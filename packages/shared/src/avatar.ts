import { LOOK_COLORS, OUTFITS, type OutfitId } from "./world";

export const GENDERS = ["male", "female"] as const;
export type GenderId = (typeof GENDERS)[number];

export const HAIR_STYLES = ["short", "long"] as const;
export type HairStyleId = (typeof HAIR_STYLES)[number];

export const SKIN_COLORS = ["#f6d7c3", "#e0ac69", "#c68642", "#8d5524", "#f3e6d8"] as const;
export const HAIR_COLORS = ["#1a1024", "#4a3428", "#8d5524", "#e0b050", "#c084fc", "#f8fafc"] as const;

export interface AvatarConfig {
  userId: string;
  gender: GenderId;
  skinColor: string;
  hairColor: string;
  outfitColor: string;
  avatarModel: HairStyleId;
  outfit: OutfitId;
  isCreated: boolean;
}

export function isGender(value: string): value is GenderId {
  return (GENDERS as readonly string[]).includes(value);
}

export function isHairStyle(value: string): value is HairStyleId {
  return (HAIR_STYLES as readonly string[]).includes(value);
}

export function isSkinColor(value: string): boolean {
  return (SKIN_COLORS as readonly string[]).includes(value);
}

export function isHairColor(value: string): boolean {
  return (HAIR_COLORS as readonly string[]).includes(value);
}

export function isOutfitColor(value: string): boolean {
  return (LOOK_COLORS as readonly string[]).includes(value);
}

export function defaultAvatar(gender: GenderId = "male"): Omit<AvatarConfig, "userId" | "isCreated"> {
  return gender === "female"
    ? { gender, skinColor: "#f6d7c3", hairColor: "#4a3428", outfitColor: "#f472b6", avatarModel: "long", outfit: "hoodie" }
    : { gender: "male", skinColor: "#e0ac69", hairColor: "#1a1024", outfitColor: "#c084fc", avatarModel: "short", outfit: "hoodie" };
}

export function sanitizeAvatar(input: {
  gender?: string;
  skinColor?: string;
  hairColor?: string;
  outfitColor?: string;
  avatarModel?: string;
  outfit?: string;
}): Omit<AvatarConfig, "userId" | "isCreated"> | null {
  const gender = input.gender ?? "";
  const skinColor = input.skinColor ?? "";
  const hairColor = input.hairColor ?? "";
  const outfitColor = input.outfitColor ?? "";
  const avatarModel = input.avatarModel ?? "";
  const outfit = input.outfit ?? "";
  if (!isGender(gender) || !isSkinColor(skinColor) || !isHairColor(hairColor) || !isOutfitColor(outfitColor) || !isHairStyle(avatarModel)) return null;
  if (outfit !== "hoodie" && outfit !== "vest") return null;
  return { gender, skinColor, hairColor, outfitColor, avatarModel, outfit };
}
