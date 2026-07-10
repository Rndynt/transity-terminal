---
name: Dev server has no hot-reload for backend
description: npm run dev runs plain tsx (no watch mode) — backend code edits are not picked up until the workflow is restarted.
---

The `dev` script in `package.json` is `NODE_ENV=development tsx server/index.ts` — a single run, not `tsx watch`. Vite HMR covers the frontend, but backend/server files are loaded once at process start.

**Why:** Testing an API change with curl right after an `Edit` can show stale behavior even though the file on disk is correct, because the running process still has the old code loaded.

**How to apply:** After editing anything under `server/` (routes, services, repositories), restart the `Start application` workflow before curling the API or trusting a "still broken" observation.
