import { build } from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: ["server/index.ts"],
  platform: "node",
  packages: "external",
  bundle: true,
  format: "esm",
  outdir: "dist",
  alias: {
    "@shared": path.resolve(__dirname, "shared"),
    "@server": path.resolve(__dirname, "server"),
    "@modules": path.resolve(__dirname, "server", "modules"),
  },
});
