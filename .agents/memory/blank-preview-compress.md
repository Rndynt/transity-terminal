---
name: Blank preview with working backend, caused by response compression
description: Symptom "API/backend works but frontend preview is blank white, no console errors" traced to global gzip/br compression on Vite dev responses.
---

If a user reports the backend works but the Replit preview pane shows a blank white page, with zero browser console errors and curl to `127.0.0.1:<port>` returning the full HTML fine — check whether the server has a compression plugin (e.g. `@fastify/compress`, `compression` for Express) registered globally in development.

**Why:** Compressing Vite's dev-server HTML/module responses can produce a body that arrives empty (200 status, content-length 0) specifically through Replit's preview proxy, even though direct localhost curl and the raw dev server work perfectly. No JS error is thrown because the page never gets a body to execute.

**How to apply:** Reproduce by curling `https://$REPLIT_DEV_DOMAIN/` (not localhost) and checking for `content-length: 0` despite a 200 status. Fix by gating global compression on `NODE_ENV === 'production'` (compression is a prod optimization anyway; Vite dev responses don't need it).

Separately, also check `@fastify/helmet` (or equivalent) `frameguard`/`X-Frame-Options` — if left at default (`SAMEORIGIN`) it can block the app from rendering inside Replit's iframe preview. Gate it off in non-production too.
