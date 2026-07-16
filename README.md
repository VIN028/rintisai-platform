# RintisAI Platform

RintisAI is a multi-model AI chat and developer API platform for Indonesian users. It supports web chat subscriptions, OpenAI-compatible API keys, Anthropic-compatible Claude routes, admin operations, payment upgrades, usage quotas, and package entitlements.

## Development

Install dependencies and run the local app:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Useful Commands

```bash
npm run build
npm run test:e2e
npx prisma generate
```

## Main Areas

- Web chat and subscription UX: `src/app/page.js`
- Admin dashboard: `src/app/admin/`
- Public API docs: `src/app/docs/api/page.js`
- OpenAI-compatible API: `src/app/api/v1/chat/completions/route.js`
- Anthropic-compatible API: `src/app/api/v1/messages/route.js`
- Plans and quotas: `src/lib/plans.js`, `src/lib/quota.js`, `src/lib/entitlements.js`
- Model configuration: `src/lib/models.js`

## Deployment

Production is self-hosted. Build the app, restart the Node/PM2 process, and keep runtime secrets in environment variables. Do not commit `.env` files or local database files.
