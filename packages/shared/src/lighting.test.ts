import { describe, expect, it } from "vitest";
import { FLASH_MAX, lightSample, sanitizeLighting, stepDanceLight, type LightingState } from "./lighting";

describe("lighting settings", () => {
  it("caps flash speed so fast mode cannot strobe", () => {
    const next = sanitizeLighting({ flashSpeed: 30, effectMode: "disco", color: "#ff00aa" }, 4);
    expect(next.flashSpeed).toBe(FLASH_MAX);
    expect(next.effectMode).toBe("disco");
    expect(next.revision).toBe(4);
  });

  it("rejects unknown modes and bad colors", () => {
    const next = sanitizeLighting({ effectMode: "strobe" as "disco", color: "red", brightness: 4 }, 1);
    expect(next.effectMode).toBe("pulse");
    expect(next.color).toBe("#c084fc");
    expect(next.brightness).toBe(1);
  });

  it("keeps chill and dance show, and stores strobe as its own switch", () => {
    const next = sanitizeLighting({ effectMode: "dance-show", strobe: true, colorStyle: "cycle", spotTarget: "dancer", flashSpeed: 9 }, 2);
    expect(next.effectMode).toBe("dance-show");
    expect(next.strobe).toBe(true);
    expect(next.colorStyle).toBe("cycle");
    expect(next.spotTarget).toBe("dancer");
    expect(next.flashSpeed).toBe(FLASH_MAX);
  });

  it("switches to dance show with the dancer and restores the previous mode", () => {
    const room = sanitizeLighting({ effectMode: "chill", spotTarget: "stage" }, 1);
    const on = stepDanceLight(room, null, true);
    expect(on.changed).toBe(true);
    expect(on.state.effectMode).toBe("dance-show");
    expect(on.state.spotTarget).toBe("dancer");
    expect(on.hold?.mode).toBe("chill");
    const still = stepDanceLight(on.state, on.hold, true);
    expect(still.changed).toBe(false);
    const back = stepDanceLight(on.state, on.hold, false);
    expect(back.state.effectMode).toBe("chill");
    expect(back.state.spotTarget).toBe("stage");
    expect(back.hold).toBeNull();
  });

  it("renders the same color on every client and keeps strobe above a blackout", () => {
    const room: LightingState = { ...sanitizeLighting({ effectMode: "disco", strobe: true, colorStyle: "cycle", startedAt: 1_000 }, 1), startedAt: 1_000 };
    const a = lightSample(room, 4_000, false);
    const b = lightSample(room, 4_000, false);
    expect(a.primary).toBe(b.primary);
    expect(a.strobe).toBeGreaterThanOrEqual(0.45);
    expect(a.lasers).toBe(true);
    const calm = lightSample(room, 4_000, true);
    expect(calm.strobe).toBe(1);
    expect(calm.lasers).toBe(false);
  });
});