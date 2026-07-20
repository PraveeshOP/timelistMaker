# Timelist Maker

Cross-platform desktop app for tracking work hours across multiple workplaces and
exporting monthly timesheets to Excel. Built with Electron, TypeScript, React,
and Supabase.

## Stack

- **Electron** (packaged with electron-builder for Windows `.exe`/`.msi` and macOS `.dmg`)
- **TypeScript** everywhere (main, preload, renderer)
- **React** renderer UI, built with **Vite** via **electron-vite**
- **Tailwind CSS** for styling
- **Supabase** for authentication (email/password + Google OAuth) and Postgres storage
- **exceljs** for `.xlsx` export

## Folder structure

```
src/
├── main/          # Electron main process: window, OAuth deep-link handling, IPC
├── preload/       # contextBridge — the only thing the renderer can call into Node/Electron with
├── renderer/       # React app (screens, components, contexts, Supabase client)
└── shared/        # Pure logic shared by main + renderer: types, holiday calculator,
                    # timelist generator, IPC contract — no Electron/DOM/Node APIs
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

Google sign-in in Electron works by opening the user's system browser for the Google
consent screen, then handing control back to the app via a custom `timelistmaker://`
protocol link (embedding Google's login inside an in-app browser window is blocked by
Google). Wiring this up requires configuring both Google Cloud Console and Supabase:

**Google Cloud Console:**
1. Create (or reuse) a project at [console.cloud.google.com](https://console.cloud.google.com).
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID**, type **Web application**.
3. Under **Authorized redirect URIs**, add Supabase's fixed callback:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
   (Google does not accept a custom `timelistmaker://` scheme directly — Supabase is the
   fixed intermediary that performs the final redirect into the app.)
4. Copy the generated **Client ID** and **Client Secret**.

**Supabase Dashboard:**
1. **Authentication → Providers → Google** — enable it and paste the Client ID/Secret.
2. **Authentication → URL Configuration → Redirect URLs** — add:
   `timelistmaker://auth-callback`

No further app-side configuration is needed — the protocol handler is registered
automatically when the app starts (see `src/main/protocol.ts`).

> Note: OS-level protocol registration is most reliable against a **built** app. In dev
> mode (`npm run dev`) the OS may not consistently hand off the custom-scheme redirect to
> an unpackaged Electron process on every platform — if Google sign-in doesn't return to
> the app in dev, verify it again against a `dist:mac`/`dist:win` build.

## 3. Running in development

```bash
npm install
npm run dev
```

This starts electron-vite in dev mode with HMR for the renderer and auto-restart for
the main/preload processes.

## 4. Building installers

```bash
npm run dist:mac    # macOS .dmg (universal: x64 + arm64)
npm run dist:win    # Windows .exe (NSIS) + .msi
```

Both scripts run `npm run build` first (typecheck + electron-vite build) and then
electron-builder. Cross-building macOS installers from Windows (or vice versa) is not
supported by electron-builder without extra tooling — build each platform's installer
on that platform, or use a CI matrix.

These produce **unsigned** installers, which is fine for local testing and internal
distribution:
- **macOS**: Gatekeeper will show an "unidentified developer" warning on first launch
  (right-click → Open to bypass). To ship a signed/notarized build, get an Apple
  Developer ID certificate and fill in `mac.identity` + set up a notarization step in
  `electron-builder.yml`.
- **Windows**: SmartScreen may warn on first run. To sign, set `win.certificateFile` /
  `win.certificatePassword` (or `CSC_LINK` / `CSC_KEY_PASSWORD` env vars) in
  `electron-builder.yml`.

Custom app icons: drop `icon.icns` (mac) and `icon.ico` (win) into `build/` and
uncomment the corresponding `icon:` lines in `electron-builder.yml`. Without them,
electron-builder falls back to the default Electron icon.

## 5. CI/CD (GitHub Actions)

Two workflows live in `.github/workflows/`:

- **`ci.yml`** — runs `typecheck` + `build` on every push/PR to `main`. Doesn't need any
  secrets (bundling doesn't execute the app, so missing Supabase config can't fail it).
- **`release.yml`** — on every pushed tag matching `v*.*.*` (or a manual run), builds on
  both a `macos-latest` and a `windows-latest` runner (electron-builder can't cross-build
  a `.dmg` from Linux/Windows) and publishes the resulting `.dmg`/`.exe`/`.msi` straight
  to a GitHub Release matching that tag, via electron-builder's built-in GitHub publish
  provider (`publish: { provider: github }` in `electron-builder.yml`).

**One-time setup** — add these under the repo's **Settings → Secrets and variables →
Actions**:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

(the same values from your `.env` — these get baked into the release build, since that's
the app your users will actually run). `GITHUB_TOKEN` is provided automatically; no setup
needed.

**Cutting a release:**

```bash
npm version patch   # bumps package.json's version and creates a matching git commit + tag
git push && git push --tags
```

That tag push triggers `release.yml`, which builds and attaches the installers to a new
GitHub Release. These are the same **unsigned** builds described above — first-launch
Gatekeeper/SmartScreen warnings apply the same way as a local build.

## How it works

- **Auth** — email/password or Google via Supabase Auth. Sessions persist in the
  renderer's `localStorage` (backed by the app's on-disk profile), so returning users
  stay signed in until they explicitly sign out.
- **First-time users** add one or more workplaces, then generate a blank monthly
  timelist — one row per calendar day, with weekends and Norwegian public holidays
  ("red days", computed locally via `src/shared/holidays.ts` — no network dependency)
  defaulted blank but fully editable.
- **Returning users** choose, after login, whether to generate a new month from an
  existing timelist as a template (reusing workplaces and each workplace's day-of-week
  pattern, shifted to the new month) or start from scratch.
- **Every field is editable** — date, start/stop time, hours, and workplace name — directly
  in the generated table. Hours auto-calculate from start/stop but can be overridden.
- **Export** writes an `.xlsx` (via exceljs) with one sheet per workplace plus a summary
  sheet, named `Name_Timelist_Month_Year.xlsx`, saved wherever the user picks in the
  native save dialog.
