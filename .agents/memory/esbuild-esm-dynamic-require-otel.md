---
name: esbuild ESM bundle crashes on dynamic require from OpenTelemetry/Sentry
description: "Dynamic require of ... is not supported" at runtime when esbuild bundles @sentry/node (pulls in @opentelemetry/instrumentation) into ESM format.
---

When using esbuild to produce a single-file, fully-bundled Node backend (`bundle: true`, all deps inlined) with `format: "esm"`, any dependency that does a computed/dynamic `require(x)` at module load — `@opentelemetry/instrumentation` (pulled in transitively by `@sentry/node`) is a known offender — crashes immediately at startup with `Error: Dynamic require of "..." is not supported`, thrown by esbuild's `__require` shim.

**Why:** esbuild's CJS→ESM interop shim can't resolve a `require()` call whose argument isn't a static string literal, so it emits a shim that always throws. This only manifests once you fully bundle (not `packages: "external"`) and target `format: "esm"`; it doesn't happen in normal `node_modules`-resolved dev mode.

**How to apply:** Switch that specific bundle target to `format: "cjs"` (output as `.cjs` if the project's `package.json` has `"type": "module"`, since plain `.js` would be interpreted as ESM and `require` wouldn't exist). Node's native `require` handles dynamic requires fine in CJS, unlike esbuild's shim. Also watch for two side effects of switching to CJS: (1) `import.meta.*` becomes unavailable/empty — audit call sites for `import.meta.dirname`/`import.meta.url` usage in code paths that must still run in the bundle; (2) top-level `await` in transitively-bundled files (e.g. a vite.config.ts pulled in only for a dev-only code path) will fail to build under CJS — mark that specific relative import path `external` in esbuild config so it isn't bundled at all, since it's unreachable in the production/API-only path anyway.
</content>
