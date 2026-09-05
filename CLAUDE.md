# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

UdelarHITS is a forum web app for the Universidad de la República community (categories → topics → threaded comments, in Spanish). Production at udelarhits.com. Solo-developer project — no team conventions beyond what's in this file and inline code comments.

Monorepo layout under `project/`:
- `project/backend` — Node/Express API (ESM), PostgreSQL via `pg`, Socket.IO for chat/notifications.
- `project/frontend` — React 19 + Vite SPA, React Router 7, TanStack Query.
- `project/database` — `schema.sql` (source of truth for schema) + sequential `migrations/*.sql` (applied by hand in production; no migration runner).
- `project/central` — static HTML/CSS/vanilla-JS pages (help center, legal, account actions like delete/forgot-password) served by the backend at `/central`, independent of the React app.

## Commands

All commands below assume `cd project/backend` or `cd project/frontend` unless noted.

### Backend (`project/backend`)
- `npm run dev` — start with nodemon (auto-restart).
- `npm start` — start once (`node src/server.js`).
- `npm test` — full Jest suite (`--runInBand`, ESM via `NODE_OPTIONS=--experimental-vm-modules`). **Resets and truncates the test DB** — see Testing below.
- `npx cross-env NODE_OPTIONS=--experimental-vm-modules jest --runInBand tests/<dir>/<file>.test.js` — run a single test file (there are also a couple of prewired shortcuts: `npm run test:chat`, `npm run test:block`).
- `npm run db:reset` — drop, recreate, and re-apply `schema.sql` to the dev DB (`udelarhits`).
- `npm run db:test:reset` — same for the test DB (`udelarhits_test`); Jest's `globalSetup` runs this automatically before the suite.
- `npm run db:migrate:<name>` — apply one specific migration file from `project/database/migrations/` to the dev DB (each migration has its own npm script; there's no umbrella "migrate all").
- `npm run seed:admin` / `npm run seed:test` / `npm run seed:testV2` — seed scripts under `src/seeds/`.

### Frontend (`project/frontend`)
- `npm run dev` — Vite dev server on port 5173, proxying `/api`, `/central`, and `/socket.io` (websocket) to `http://localhost:5001`.
- `npm run build` — production build (`dist/`).
- `npm run lint` — ESLint (flat config, React Hooks + React Refresh rules).
- `npm test` — Vitest (jsdom env, globals on, setup file `src/test/setup.js`). Run a single file with `npx vitest run path/to/file.test.jsx`.

### Root
- `project/package.json`'s `build` script builds the frontend then installs backend deps — this is what's used for a from-scratch deploy build (e.g. Railway). `npm start` from `project/` just runs the backend.

## Testing conventions (backend)

- Tests live in `project/backend/tests/<feature>/*.test.js`, one directory per domain area (auth, chat, moderation, category, etc.), mirroring the route/controller/service split.
- `tests/setup.js` truncates a fixed list of tables before **every** test (`beforeEach`) and hard-aborts if `DB_NAME` doesn't contain `"test"` — a safety guard against ever truncating a non-test database. If you add a new table that tests need clean, add it to the `TABLES` array there.
- `tests/global-setup.js` runs `npm run db:test:reset` once before the whole suite.
- `tests/load-env.js` loads `.env.test` (never `.env`) and fails the suite loudly if it detects prod-looking config leaking in (real `GOOGLE_VISION_API_KEY`, non-test `DB_HOST`, non-"test" `DB_NAME`, etc.). Env loading is centralized in `src/config/env.js`; don't call `dotenv.config()` anywhere else — in `NODE_ENV=test` it always loads `.env.test` with `override: true` and never falls back to `.env`.
- `tests/helpers.js` has the standard fixtures: `makeUser`, `registerAndLogin`, `createAdmin`, `createCategory`, `createTopic`, `createReply`, `createHomeReply`, `makeParticipant`, `getTagIds`. Prefer these over hand-rolling requests in new tests.
- Rate limiters in `src/app.js` are passthrough when `NODE_ENV=test` (via the `limiterIf` wrapper) so the suite doesn't hit spurious 429s.
- Set up `.env.test` from `.env.test.example` before running tests locally; it must point at a local `udelarhits_test` database, never a remote/managed host.

## Architecture (backend)

Layered, one direction of dependency: **route → controller → service → repository → db**.
- `src/routes/*.routes.js` — only define endpoints and delegate to a controller. Aggregated in `src/routes/API.js`, mounted at `/api` in `src/app.js`.
- `src/controllers/*.controller.js` — parse req/res, basic input shape, call service, pick HTTP status.
- `src/services/*.service.js` — business rules (validation, hashing, moderation thresholds, etc.).
- `src/repositories/*.repository.js` — the only layer that talks SQL to Postgres (via `src/config/db.js`'s pool).
- Don't skip layers (e.g. a controller querying `pool` directly) — this split is a deliberate, enforced convention in this codebase.

Auth: JWT in an httpOnly cookie (`jwt`), no server-side sessions. `src/middlewares/auth.middleware.js` exports `protect` (required auth, checks user is `activo` in DB, not just token validity), `isAdmin`, and `optionalAuth` (attaches `req.user` if a valid cookie is present, otherwise continues as guest). Google OAuth goes through Passport (`src/config/passport.js`) but still issues the same JWT cookie — there are no server sessions anywhere.

`src/app.js` is the composition root and is heavily order-dependent — read its comments before touching middleware order:
1. `maintenanceMiddleware` first, so `MAINTENANCE_MODE=true` can 503 everything except `/health` without touching Helmet/DB/static.
2. Helmet (CSP allowlists Google Analytics + Cloudinary; the inline anti-flash theme script in `frontend/index.html` is allowed via a sha256 hash — if you edit that inline script, recompute the hash or the browser silently blocks it).
3. `compression()` before static files (must precede anything it should compress).
4. Static files (frontend `dist/`, then `/central`, then backend's own `/assets`) served before CORS, since ES module requests carry an `Origin` header that would otherwise get rejected.
5. `/health` (checks DB with `SELECT 1`) — used by Railway, must stay reachable even in maintenance mode.
6. CORS with an explicit origin allowlist from `URL` env var (comma-separated).
7. Route-specific rate limiters (general `/api`, stricter `auth` endpoints, content-creation, reactions, search) — all wrapped in `limiterIf` to no-op under `NODE_ENV=test`.
8. `/api` routes, then SEO routes (must come after `/api`, before the SPA catch-all — see below), then the SPA fallback.
9. Two error handlers at the end: one specifically for Multer/upload errors, one generic catch-all that never leaks stack traces to the client (logs only outside production).

The server resolves `frontend/dist` from several candidate paths at boot (local repo layout vs. Railway's container layout differ) and logs which one it picked — check that log line first if static assets 404 in a deploy.

SEO routes (`src/routes/seo.routes.js`, mounted directly in `app.js`, not under `/api`) intercept specific detail URLs to inject real per-page metadata (categories, topics, profiles) for crawlers/link previews, before falling through to the SPA's `index.html` for everything else. `/assets/*` explicitly 404s instead of falling through to `index.html`, to avoid wrong MIME types on missing hashed build assets.

Realtime: `src/socket.js` (`initSocket`) wires Socket.IO for chat and live notifications. `src/utils/realtimeMode.js` and the `NOTIF_RT_*` env vars implement hysteresis-based throttling — realtime push can pause under load while notifications still persist to DB, and resume once load drops.

Background jobs: `src/jobs/cleanup.job.js` (`startCleanupJobs`, started from `server.js`, not `app.js`, so importing `app` in tests doesn't leave timers running) handles chat retention and auth housekeeping.

Content moderation: reports on categories/topics/comments accumulate and, past a threshold, auto-flip content to `inactiva`/`inactivo`/`oculto` (see `motivo_inactivacion` enum in schema — every deactivation records an explicit reason, never inferred). Authors of deactivated content can file an appeal (`apelacion`), resolved by an admin (accept restores the content and clears its reports; reject hard-deletes it and its whole reply subtree, irreversibly). Thresholds are tunable via `UMBRAL_*` env vars (see `.env.example`); see `src/services/moderation.service.js` and `src/config/trendingConfig.js` / `reportConfig.js`. Image uploads can optionally be screened via Google Cloud Vision SafeSearch (`GOOGLE_VISION_API_KEY`) — if unset, moderation is silently disabled and a warning is logged at boot.

Deletion semantics (see `docs/pendiente.md` for the full spec): content with no dependents is hard-deleted; content with replies/comments underneath is soft-deleted (status flips, title becomes reusable, body replaced by a placeholder) so the thread stays navigable.

## Architecture (frontend)

- `src/router.jsx` defines all routes via `createBrowserRouter`. `FeedPage` (the home route) is imported eagerly; every other route is `React.lazy`-loaded for code splitting — keep new top-level pages lazy unless there's a specific LCP reason not to (see comments in that file).
- `src/api/client.js` is the sole fetch wrapper (`apiGet/apiPost/apiPatch/apiPut/apiDelete`), always sends `credentials: 'include'` for the JWT cookie, and throws on non-OK responses. Use it rather than calling `fetch` directly.
- `src/context/` holds app-wide React context: `AuthContext`, `SocketContext`, `ThemeContext`, `ToastContext`.
- `src/features/<domain>/` holds page-level components and their co-located CSS (feed, category, topic, comment, profile, admin, chat, auth, settings, about, search, landing, redirect). `src/components/shared` and `src/components/ui` hold cross-feature building blocks; `src/components/layout` holds the app shell (Header, LeftNav, Sidebar, BottomNav, etc.).
- Route guards: `ProtectedRoute` (requires login) and `AdminRoute` (requires `rol === 'admin'`) wrap routes directly in `router.jsx` rather than living inside page components.
- Vite dev server proxies `/api`, `/central`, and `/socket.io` (ws) to the backend on port 5001 — run the backend separately for `npm run dev` to work end to end.
- Only `VITE_`-prefixed env vars reach the client bundle (see `.env.example` — currently just `VITE_GA4_ID`).

## Database

`project/database/schema.sql` is the authoritative current schema (PostgreSQL, requires the `unaccent` extension). `project/database/migrations/*.sql` are the incremental changes that got it there — applied by hand via the `db:migrate:<name>` npm scripts, in order, with no tracking table. When changing the schema: update `schema.sql` for anyone bootstrapping fresh (`db:reset`) *and* add a new migration file (+ npm script) for anyone with an existing database. Content states (`estado_cat`, `estado_tem`, `estado_com`) and `motivo_inactivacion` are enums — moderation logic and tests both depend on their exact values.

## Environment configuration

Both `backend/.env.example` and `frontend/.env.example` are the reference for required env vars — copy to `.env` (backend) / `.env.production` (frontend) and fill in. Backend also needs `.env.test` (from `.env.test.example`) for running tests, pointed at a local `udelarhits_test` DB — see Testing above for why this is strictly enforced.

---

Ver CLAUDE.local.md para convenciones adicionales (no versionado).
