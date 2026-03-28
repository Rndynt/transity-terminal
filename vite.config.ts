import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const isReplit = process.env.REPL_ID !== undefined;

const replitDevPlugins: Promise<Plugin>[] =
  isReplit
    ? [
        import("@replit/vite-plugin-runtime-error-modal").then((m) =>
          m.default(),
        ),
        import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer(),
        ),
        import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
      ]
    : [];

const resolved = await Promise.all(replitDevPlugins);
const serveOnly = resolved.map((p) => ({ ...p, apply: "serve" as const }));

export default defineConfig({
  plugins: [react(), ...serveOnly],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
