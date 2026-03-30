import Fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.TRANSITYWEB_PORT || '3001', 10);
const API_UPSTREAM = process.env.API_UPSTREAM || 'http://localhost:5000';

const app = Fastify({ logger: false });

app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
  done(null, body);
});

app.addHook('onRequest', async (req, reply) => {
  if (req.url.startsWith('/api/')) {
    const upstream = `${API_UPSTREAM}${req.url}`;
    try {
      const headers: Record<string, string> = {};
      const ct = req.headers['content-type'];
      if (ct) headers['content-type'] = ct;
      const authHeader = req.headers['authorization'];
      if (authHeader) headers['authorization'] = authHeader;

      let rawBody: string | undefined;
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const chunks: Buffer[] = [];
        for await (const chunk of req.raw) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        rawBody = Buffer.concat(chunks).toString('utf8');
      }

      const res = await fetch(upstream, {
        method: req.method,
        headers,
        body: rawBody || undefined,
      });

      const contentType = res.headers.get('content-type') || '';
      const body = contentType.includes('json') ? await res.json() : await res.text();

      reply.status(res.status);
      if (contentType) reply.header('content-type', contentType);
      reply.send(body);
    } catch {
      reply.status(502).send({ error: 'Layanan tidak tersedia' });
    }
    return reply;
  }
});

async function start() {
  if (isProd) {
    const fastifyStatic = await import('@fastify/static');
    app.register(fastifyStatic.default, {
      root: path.join(__dirname, '..', 'dist'),
      prefix: '/',
    });

    app.setNotFoundHandler((_req, reply) => {
      reply.sendFile('index.html');
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      root: path.join(__dirname, '..'),
      server: { middlewareMode: true, hmr: { port: 24679 } },
      appType: 'spa',
    });

    app.addHook('onRequest', async (req, reply) => {
      if (req.url.startsWith('/api/')) return;
      await new Promise<void>((resolve, reject) => {
        vite.middlewares(req.raw, reply.raw, (err: unknown) => {
          if (err) reject(err);
          else resolve();
        });
      });
      reply.hijack();
    });
  }

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`[transityweb] running on port ${PORT} (${isProd ? 'production' : 'development'})`);
  console.log(`[transityweb] API upstream: ${API_UPSTREAM}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
