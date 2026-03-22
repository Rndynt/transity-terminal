import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";

export function log(message: string, source = "fastify") {
  const formattedTime = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: FastifyInstance, server: any) {
  const viteLib = await import("vite");
  const createViteServer = viteLib.createServer;
  const createLogger = viteLib.createLogger;
  const viteConfigModule = await import("../vite.config");
  const viteConfig = viteConfigModule.default;
  const nanoidModule = await import("nanoid");
  const nanoid = nanoidModule.nanoid;

  const viteLogger = createLogger();

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg: string, options?: any) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.get("*", async (req, reply) => {
    const url = req.url;

    if (url.startsWith("/api")) {
      return;
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      reply.type("text/html").send(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      throw e;
    }
  });
}

export async function serveStatic(app: FastifyInstance) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  await app.register(import("@fastify/static"), {
    root: distPath,
    wildcard: false,
  });

  app.get("*", async (req, reply) => {
    if (req.url.startsWith("/api")) {
      return;
    }
    return reply.sendFile("index.html");
  });
}
