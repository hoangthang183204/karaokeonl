import { describe, expect, it } from "vitest";
import { defaultAvatar, sanitizeAvatar } from "./avatar";

describe("avatar", () => {
  it("keeps a complete palette choice", () => {
    const next = sanitizeAvatar({ ...defaultAvatar("female"), outfit: "vest" });
    expect(next?.gender).toBe("female");
    expect(next?.avatarModel).toBe("long");
    expect(next?.outfit).toBe("vest");
  });

  it("rejects a color outside the palette", () => {
    expect(sanitizeAvatar({ ...defaultAvatar("male"), skinColor: "#000000" })).toBeNull();
  });
});