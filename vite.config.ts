import { defineConfig } from "vite";

// GitHub Pages liefert die Seite unter /fieldstats1/ aus.
export default defineConfig({
  base: "./",
  build: { target: "es2022", sourcemap: true },
  test: { environment: "jsdom", include: ["tests/unit/**/*.test.ts"] },
});
