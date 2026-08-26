# Timelist Maker

Web app for tracking work hours across multiple workplaces and exporting monthly
timesheets to Excel. Built with TypeScript, React, Vite, and Supabase.

## Stack

- **React** + **TypeScript**, built with **Vite**
- **Tailwind CSS** for styling
- **Supabase** for authentication (email/password + Google OAuth) and Postgres storage
- **exceljs** for `.xlsx` export (built entirely client-side, handed to the browser as a download)

## Folder structure

```
src/
├── screens/       # Login/signup, post-login choice, workplace setup, timelist editor
├── components/    # Calendar view, workplace tables, export bar, top bar, ui primitives
├── context/       # Auth + timelist React contexts (Supabase-backed)
├── lib/           # Supabase client, data access, Excel export/import
└── shared/        # Pure logic: domain types, Norwegian holiday calculator, timelist
                    # generator — no DOM/browser APIs, easy to unit-test in isolation
supabase/
└── migrations/    # SQL schema + Row Level Security policies
```

## 1. Supabase project setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   This creates the `users`, `workplaces`, `timelists`, and `time_entries` tables, a
   trigger that populates `public.users` on sign-up, and Row Level Security policies so
   each user only ever sees their own rows.
3. Go to **Project Settings → API** and copy the **Project URL** and **anon public key**.
4. Copy `.env.example` to `.env` and fill them in:

   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

## 2. Google OAuth setup

Standard Supabase web OAuth flow: clicking "Sign in with Google" redirects the whole
page to Google's consent screen, then back to this app's own URL with the session
attached — no extra app-side plumbing needed beyond configuring the two providers.

**Google Cloud Console:**
1. Create (or reuse) a project at [console.cloud.google.com](https://console.cloud.google.com).
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID**, type **Web application**.
3. Under **Authorized redirect URIs**, add Supabase's fixed callback:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. Copy the generated **Client ID** and **Client Secret**.

**Supabase Dashboard:**
1. **Authentication → Providers → Google** — enable it and paste the Client ID/Secret.
2. **Authentication → URL Configuration → Redirect URLs** — add every URL the app will
   actually be served from, e.g.:
   - `http://localhost:5173` (Vite's default dev server)
   - `https://your-app.vercel.app` (production, once deployed)
   - any Vercel preview-deployment domain pattern you want to support

## 3. Running in development

```bash
npm install
npm run dev
```

Starts the Vite dev server (default `http://localhost:5173`) with HMR.

## 4. Building for production

```bash
npm run build      # typecheck + vite build → dist/
npm run preview    # serve the dist/ build locally to sanity-check it
```

## 5. Deploying (Vercel)

A `vercel.json` is included (`buildCommand: npm run build`, `outputDirectory: dist`,
with a catch-all rewrite to `index.html`).

1. Import the repo at [vercel.com/new](https://vercel.com/new) — Vercel auto-detects
   the Vite project; the settings from `vercel.json` are picked up automatically.
2. Add the two Supabase env vars under **Project Settings → Environment Variables**:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Deploy. Once you have the real `https://….vercel.app` URL, add it to Supabase's
   **Authentication → URL Configuration → Redirect URLs** (step 2 above) — Google
   sign-in won't return to the app correctly until that's added.

Every push to `main` (once connected) triggers a new Vercel deployment automatically —
no GitHub Actions workflow needed for that part; `.github/workflows/ci.yml` still runs
`typecheck` + `build` on every push/PR as a fast correctness check independent of Vercel.

## How it works

- **Auth** — email/password or Google via Supabase Auth. Sessions persist in
  `localStorage`, so returning users stay signed in until they explicitly sign out.
- **First-time users** add one or more workplaces, then generate a blank monthly
  timelist — one row per calendar day, with weekends and Norwegian public holidays
  ("red days", computed locally via `src/shared/holidays.ts` — no network dependency)
  defaulted blank but fully editable.
- **Returning users** choose, after login, whether to generate a new month from an
  existing timelist as a template (reusing workplaces and each workplace's day-of-week
  pattern, shifted to the new month), start from scratch, or import a previously
  exported `.xlsx` file (drag-and-drop or file picker) to reconstruct that month's data.
- **Every field is editable** — date, start/stop time, hours, and workplace name —
  directly in the generated tables, or via the calendar view (a month grid where
  clicking a day edits that day's hours for every workplace at once). Hours
  auto-calculate from start/stop but can be overridden; the "repeat week 1" button
  fills in the rest of the month from the first week's pattern.
- **Export** builds an `.xlsx` (via exceljs, matching a specific two-table-per-workplace
  layout) entirely in the browser and hands it to the browser's own download flow,
  named `Name_Timelist_Month_Year.xlsx`.
