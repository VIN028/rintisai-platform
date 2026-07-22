<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:rintisai-dev-standards -->
RintisAI Development Standards

Branch Strategy
- main - production-ready, deployed. Merge strictly via PR only.
- dev - integration branch for daily development.
- Feature branches: feat/, branched from dev.
- Fix branches: fix/, branched from dev.

Commit Convention
Use Conventional Commits:
- feat: new feature
- fix: bug fix
- chore: maintenance tasks (dependencies, config, etc.)
- refactor: code changes without changing functionality
- style: changes to formatting, whitespace (not logic)
- docs: documentation changes
- test: adding/improving tests

Changelog Convention:
- Write in CHANGELOG.md
- Write any updates in every commit made
- Use YYYY-MM-DD v1 / v2 / v3 etc

Other Convention:
- Always update any .md documents (prioritize README.md / CHANGELOG.md and AGENTS.md)
- Use regular hyphen (-) for punctuation; never use Em Dash (—) or En Dash (–) in code or documentation

Write in English, ensuring the commit description is clear and concise.

Code Conventions

File & Folder Naming
- kebab-case for all files and directories (except page.js, route.js, layout.js which follow Next.js conventions).
- API routes: src/app/api//route.js
- Pages: src/app//page.js
- Library: src/lib/.js

Import Style
- Use the @/ alias (configured in jsconfig.json).
- Named exports for utilities and route handlers.
- Default exports exclusively for page components.
- Import directly from modules, avoiding barrel files.

API Routes
export async function GET(req) { ... }
export async function POST(req) { ... }
- Parse body: const body = await req.json().catch(() => ({}))
- Response: NextResponse.json({ ... }) or new Response(stream, { headers })
- Error: NextResponse.json({ error: "..." }, { status: 4xx })
- Wrap handlers in a try/catch block, returning a 500 status code in the catch block.
- Use authenticateUser(req) from @/lib/auth for cookie authentication, or Bearer tokens for API keys.

Components (Pages)
- Server components by default (without "use client").
- Client components only when interactivity is required (place "use client" on the very first line).
- Function declaration: export default function ComponentName() { ... }
- Arrow functions only for internal file helpers: const helper = (...) => { ... }
- Tailwind CSS utility classes. Inline style={{}} is permitted only for dynamic values.

Variable Naming
- camelCase: variables, functions, parameters.
- UPPER_SNAKE_CASE: configuration-level constants.
- snake_case: plan/model IDs, Prisma fields.

Database (Prisma + SQLite)
- Import the client from @/lib/db: import prisma from "@/lib/db"
- Field names: camelCase.
- Do not commit .db or .sqlite files to the repository.

Error Handling
- Every route handler must be wrapped in a try/catch block.
- Log errors server-side: console.error("Label:", err)
- Do not expose stack traces to the client.

Testing
- E2E tests via Playwright: npm run test:e2e
- Place test files in the tests/ directory.

Linting & Build
- Run npm run lint before committing code.
- Ensure npm run build succeeds before merging into dev or main.
- Environment: Next.js 16 + React 19 - refer to the docs in node_modules/next/dist/docs/ if you are uncertain about any API.

Schema & Migration
- Every Prisma schema change must be accompanied by a new migration: npx prisma migrate dev --name <descriptive_name>
- After pulling new migrations from git, run: npx prisma migrate deploy
- Keep prisma/seed.js in sync with the current schema at all times.
- Run npm run seed after migrate deploy to reset demo/admin users.
- Data migration between providers (e.g. SQLite to PostgreSQL) must be documented in MIGRATION.md.
- Migration scripts live in the scripts/ directory and use Prisma's dual-adapter pattern.
- Always verify row counts after data migration before cutting over to the new database.

Security
- Never commit secrets, .env files, or local database files.
- Use environment variables for all sensitive configurations.
- Adhere to the security headers specified in next.config.mjs.
<!-- END:rintisai-dev-standards -->