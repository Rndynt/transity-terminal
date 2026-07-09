import { build } from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sharedAlias = {
  "@shared": path.resolve(__dirname, "shared"),
  "@server": path.resolve(__dirname, "server"),
  "@modules": path.resolve(__dirname, "server", "modules"),
};

// Build frontend (Vite) + backend bundle, pakai packages:"external"
// supaya node_modules tetap di-resolve dari disk (cocok untuk Replit dev).
export async function buildFull() {
  await build({
    entryPoints: ["server/index.ts"],
    platform: "node",
    packages: "external",
    bundle: true,
    format: "esm",
    outdir: "dist",
    alias: sharedAlias,
  });
}

// Build backend ONLY — bundle semua deps ke dalam satu file.
// VM tidak perlu npm ci sama sekali, cukup: node dist/index.cjs
// Output pakai format CJS (.cjs) karena beberapa dependency (mis.
// @opentelemetry/instrumentation via @sentry/node) memakai dynamic
// `require()` yang tidak jalan lewat esbuild-nya format ESM (Node
// melempar "Dynamic require of ... is not supported").
// External hanya:
//   - vite / @vitejs/* / vite.config — dev only, tidak dipakai saat SERVE_STATIC=false
//   - bufferutil / utf-8-validate / pg-native — optional native bindings
export async function buildApiBundle() {
  await build({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outdir: "dist",
    outExtension: { ".js": ".cjs" },
    alias: sharedAlias,
    // Packages yang TIDAK di-bundle (tetap external):
    external: [
      // Dev-only / frontend
      "vite",
      "@vitejs/plugin-react",
      "@vitejs/plugin-react-swc",
      "@replit/vite-plugin-cartographer",
      "@replit/vite-plugin-dev-banner",
      "@replit/vite-plugin-runtime-error-modal",
      "../vite.config",
      // Optional native bindings — tidak wajib ada di production
      "bufferutil",
      "utf-8-validate",
      "pg-native",
    ],
    // Suppress warnings untuk optional peer deps yang memang tidak di-bundle
    logOverride: {
      "missing-optional-dependency": "silent",
    },
  });
}

// Deteksi mode dari argument: `node esbuild.config.js --bundle` = bundled
const isBundleMode = process.argv.includes("--bundle");

if (isBundleMode) {
  await buildApiBundle();
} else {
  await buildFull();
}
