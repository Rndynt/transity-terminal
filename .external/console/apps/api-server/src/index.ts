import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname_idx = path.dirname(fileURLToPath(import.meta.url));
for (const candidate of [
  path.resolve(__dirname_idx, "../.env"),
  path.resolve(__dirname_idx, "../../.env"),
]) {
  if (fs.existsSync(candidate)) {
    for (const raw of fs.readFileSync(candidate, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[k] = v;
    }
    break;
  }
}

const { buildApp } = await import("./app.js");

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const app = await buildApp();

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error({ err }, "Error starting server");
  process.exit(1);
}
