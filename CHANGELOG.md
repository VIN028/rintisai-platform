2026-07-17 v1

- Create `dev` branch from `main` for daily development
- Add development standards to `AGENTS.md` (branch strategy, commit conventions, code conventions)
- Set up Node.js 20 via nvm, install dependencies, and generate Prisma client

2026-07-17 v2

- Update `next.config.mjs`:
  - Add `'unsafe-eval'` to CSP `script-src` (React dev mode compatibility)
  - Add `ws://localhost:3000 wss://*.echo.my.id` to CSP `connect-src` (HMR WebSocket)
  - Add `allowedDevOrigins: ['*.echo.my.id']` (dev server behind Cloudflare Tunnel)
- Update `package.json` dev script to `next dev -H 0.0.0.0` (bind all interfaces)

2026-07-17 v3

- Rewrite `AGENTS.md` with latest RintisAI development standards (Changelog, English-only, plain text format)
- Add Changelog Convention: YYYY-MM-DD v1/v2/v3 format
- Add Other Convention: always update .md docs on every commit
