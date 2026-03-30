import Fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.TRANSITYWEB_PORT || '5000', 10);
const API_UPSTREAM = process.env.API_UPSTREAM || 'https://www.transity.web.id';

const app = Fastify({ logger: false });

app.addHook('onRequest', async (req, reply) => {
  if (req.url.startsWith('/api/')) {
    const upstream = `${API_UPSTREAM}${req.url}`;
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      const authHeader = req.headers['authorization'];
      if (authHeader) headers['authorization'] = authHeader;

      const res = await fetch(upstream, {
        method: req.method,
        headers,
        body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined,
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
