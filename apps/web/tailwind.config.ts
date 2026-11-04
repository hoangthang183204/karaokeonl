import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#07060f",
        neon: "#c084fc",
        magenta: "#f472b6",
        aqua: "#67e8f9",
      },
      boxShadow: {
        glass: "0 10px 40px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
