import { create } from "zustand";

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
}

interface SessionStore {
  token: string | null;
  user: SessionUser | null;
  ready: boolean;
  hydrate: () => void;
  setSession: (token: string, user: SessionUser) => void;
  clear: () => void;
}

export const useSession = create<SessionStore>((set) => ({
  token: null,
  user: null,
  ready: false,
  hydrate: () => {
    const token = localStorage.getItem("karaoke.token");
    const raw = localStorage.getItem("karaoke.user");
    set({ token, user: raw ? (JSON.parse(raw) as SessionUser) : null, ready: true });
  },
  setSession: (token, user) => {
    localStorage.setItem("karaoke.token", token);
    localStorage.setItem("karaoke.user", JSON.stringify(user));
    set({ token, user, ready: true });
  },
  clear: () => {
    localStorage.removeItem("karaoke.token");
    localStorage.removeItem("karaoke.user");
    set({ token: null, user: null, ready: true });
  },
}));
