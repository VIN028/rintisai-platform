<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:rintisai-dev-standards -->
# RintisAI Development Standards

## Branch Strategy
- `main` — production-ready, deployed. Hanya merge via PR.
- `dev` — integration branch untuk development daily.
- Feature branches: `feat/<nama-fitur>`, bercabang dari `dev`.
- Fix branches: `fix/<nama-fix>`, bercabang dari `dev`.

## Commit Convention
Gunakan **Conventional Commits**:
```
feat: fitur baru
fix: perbaikan bug
chore: tugas maintenance (deps, config, dll)
refactor: perubahan kode tanpa perubahan fungsionalitas
style: perubahan formatting, whitespace (bukan logika)
docs: perubahan dokumentasi
test: penambahan/perbaikan test
```
Tulis dalam **Bahasa Inggris**, pastikan commit description jelas dan ringkas.

## Code Conventions

### File & Folder Naming
- **kebab-case** untuk semua file dan direktori (kecuali `page.js`, `route.js`, `layout.js` yang merupakan konvensi Next.js).
- API routes: `src/app/api/<kebab-case>/route.js`
- Pages: `src/app/<kebab-case>/page.js`
- Library: `src/lib/<kebab-case>.js`

### Import Style
- Gunakan `@/` alias (dari `jsconfig.json`).
- **Named exports** untuk utilitas dan route handler.
- **Default exports hanya** untuk page component.
- Import langsung dari modul, tanpa barrel file.

### API Routes
```js
export async function GET(req) { ... }
export async function POST(req) { ... }
```
- Parse body: `const body = await req.json().catch(() => ({}))`
- Response: `NextResponse.json({ ... })` atau `new Response(stream, { headers })`
- Error: `NextResponse.json({ error: "..." }, { status: 4xx })`
- Bungkus handler dalam `try/catch`, kembalikan 500 di catch.
- Gunakan `authenticateUser(req)` dari `@/lib/auth` untuk cookie auth, atau Bearer token untuk API key.

### Components (Pages)
- **Server component** sebagai default (tanpa `"use client"`).
- **Client component** hanya jika perlu interaktivitas/interactivity (gunakan `"use client"` di baris pertama).
- Function declaration: `export default function ComponentName() { ... }`
- Arrow function hanya untuk helpers di dalam file: `const helper = (...) => { ... }`
- Tailwind CSS utility classes. Inline `style={{}}` diperbolehkan jika nilai dinamis.

### Naming Variabel
- **camelCase**: variable, function, parameter.
- **UPPER_SNAKE_CASE**: constants tingkat konfigurasi.
- **snake_case**: plan/model IDs, field Prisma.

### Database (Prisma + SQLite)
- Import client dari `@/lib/db`: `import prisma from "@/lib/db"`
- Field names: camelCase.
- Jangan commit file `.db` atau `.sqlite` ke repository.

### Error Handling
- Setiap route handler dibungkus `try/catch`.
- Log error server-side: `console.error("Label:", err)`
- Jangan expose stack trace ke client.

### Testing
- E2E tests via Playwright: `npm run test:e2e`
- Test file di direktori `tests/`.

### Linting & Build
- Jalankan `npm run lint` sebelum commit.
- Pastikan `npm run build` berhasil sebelum merge ke `dev`/`main`.
- Model: **Next.js 16 + React 19** — baca docs di `node_modules/next/dist/docs/` jika ragu dengan API.

## Security
- Jangan commit secrets, `.env`, atau file database lokal.
- Gunakan environment variables untuk semua konfigurasi sensitif.
- Ikuti security headers yang sudah ditetapkan di `next.config.mjs`.
<!-- END:rintisai-dev-standards -->
