import express, { type Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { scheduler } from "./scheduler";
import { existsSync } from "fs";
import { join } from "path";

const app = express();
app.use(express.json({
  verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
    if (req.url === '/api/app/payments/webhook') {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: false }));

const SENSITIVE_PATHS = ['/api/app/auth/login', '/api/app/auth/register', '/api/app/payments/webhook'];
const SENSITIVE_KEYS = new Set(['token', 'password', 'passwordHash', 'providerRef', 'authorization']);

function redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactSensitive(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && !SENSITIVE_PATHS.includes(path)) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      } else if (capturedJsonResponse && SENSITIVE_PATHS.includes(path)) {
        logLine += ` :: ${JSON.stringify(redactSensitive(capturedJsonResponse))}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: Error & { status?: number; statusCode?: number; code?: string }, _req: Request, res: Response, _next: NextFunction) => {
    // PostgreSQL unique constraint violation  (code 23505)
    // detail example: "Key (code)=(JKT-BDG-A) already exists."
    if (err.code === '23505') {
      const detail: string = (err as any).detail ?? '';
      const valueMatch = detail.match(/Key \([^)]+\)=\(([^)]+)\)/);
      const fieldMatch = detail.match(/Key \(([^)]+)\)=/);
      const value = valueMatch ? valueMatch[1] : null;
      const field = fieldMatch ? fieldMatch[1] : 'data';
      const msg = value
        ? `Kode "${value}" sudah digunakan. Gunakan ${field} yang berbeda.`
        : `Nilai ${field} sudah digunakan. Gunakan nilai yang berbeda.`;
      res.status(409).json({ message: msg });
      return;
    }

    // Zod validation error
    if (err instanceof ZodError) {
      const messages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      res.status(400).json({ message: `Data tidak valid: ${messages}` });
      return;
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Serve mobile web app static build at /mobile
  const mobileDist = join(process.cwd(), "apps/mobile/dist");
  if (existsSync(mobileDist)) {
    app.use("/mobile", express.static(mobileDist));
    app.get("/mobile/*", (_req: Request, res: Response) => {
      res.sendFile(join(mobileDist, "index.html"));
    });
    log("Mobile web app served at /mobile");
  }

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Start the scheduler for auto-cleanup
    scheduler.start();
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    scheduler.stop();
  });
  
  process.on('SIGINT', () => {
    scheduler.stop();
    process.exit(0);
  });
})();
