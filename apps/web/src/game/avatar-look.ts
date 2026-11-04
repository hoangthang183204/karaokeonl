import type { AvatarConfig } from "@karaoke/shared";
import { localMotion } from "./runtime";

export function applyAvatar(avatar: Pick<AvatarConfig, "gender" | "skinColor" | "hairColor" | "outfitColor" | "avatarModel" | "outfit">) {
  localMotion.gender = avatar.gender;
  localMotion.skinColor = avatar.skinColor;
  localMotion.hairColor = avatar.hairColor;
  localMotion.avatarModel = avatar.avatarModel;
  localMotion.color = avatar.outfitColor;
  localMotion.outfit = avatar.outfit;
  window.localStorage.setItem("karaoke.avatar", JSON.stringify(avatar));
  window.localStorage.setItem("karaoke.look", JSON.stringify({ color: avatar.outfitColor, outfit: avatar.outfit }));
}

export function lookMessage() {
  return {
    color: localMotion.color,
    outfit: localMotion.outfit,
    gender: localMotion.gender,
    skinColor: localMotion.skinColor,
    hairColor: localMotion.hairColor,
    avatarModel: localMotion.avatarModel,
  };
}
