export const fxSettings = {
  showHp: true,
  reduceCamera: false,
  reduceBlur: false,
  disableWarp: false,
  reduceMotion: false,
  disableEyelids: false,
};

const KEY = "karaoke.fx";

export function loadFxSettings() {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || "{}") as Partial<typeof fxSettings>;
    (Object.keys(fxSettings) as (keyof typeof fxSettings)[]).forEach((key) => {
      if (typeof raw[key] === "boolean") fxSettings[key] = raw[key];
    });
  } catch {
    // Giữ mặc định nếu dữ liệu cũ bị hỏng.
  }
}

export function saveFxSettings() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(fxSettings));
}
