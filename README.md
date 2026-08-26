# Timelist Maker

Web app for tracking work hours across multiple workplaces and exporting monthly
timesheets to Excel. Built with TypeScript, React, Vite, and Firebase.

## Stack

- **React** + **TypeScript**, built with **Vite**
- **Tailwind CSS** for styling
- **Firebase** for authentication (email/password + Google) and storage (Firestore)
- **exceljs** for `.xlsx` export (built entirely client-side, handed to the browser as a download)

## Folder structure

```
src/
├── screens/       # Login/signup, post-login choice, workplace setup, timelist editor
├── components/    # Calendar view, workplace tables, export bar, top bar, ui primitives
├── context/       # Auth + timelist React contexts (Firebase-backed)
├── lib/           # Firebase client, data access, Excel export/import
└── shared/        # Pure logic: domain types, Norwegian holiday calculator, timelist
                    # generator — no DOM/browser APIs, easy to unit-test in isolation
firestore.rules    # Security rules — every user can only read/write their own data
firebase.json      # Points the Firebase CLI at firestore.rules for deployment
```

## 1. Firebase project setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Build → Authentication → Get started** — enable the **Email/Password** and
   **Google** sign-in providers (Sign-in method tab). Unlike a typical OAuth setup,
   Google sign-in needs no separate Google Cloud Console configuration — Firebase
   handles the client ID/secret for you.
3. **Build → Firestore Database → Create database** — start in production mode (the
   security rules below replace the default deny-all).
4. Deploy `firestore.rules` (every user can only read/write documents under their own
   `users/{uid}/...` subtree — see the file for the exact rules):
   - Easiest: open **Firestore Database → Rules** in the console, paste in the contents
     of [`firestore.rules`](firestore.rules), and publish.
   - Or, with the [Firebase CLI](https://firebase.google.com/docs/cli) installed:
     `firebase deploy --only firestore:rules --project <your-project-id>`
5. **Project settings (gear icon) → General → Your apps → Add app → Web** — register
   a web app and copy the `firebaseConfig` values it gives you.
6. Copy `.env.example` to `.env` and fill in those values:

   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

## 2. Google sign-in — authorized domains

Firebase's Google sign-in (`signInWithPopup`) only works from domains you've told it
about. Under **Authentication → Settings → Authorized domains**, add every domain the
app will actually be served from:
- `localhost` (usually already there by default, covers `npm run dev`)
- `your-app.vercel.app` (production, once deployed)
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
2. Add the six Firebase env vars under **Project Settings → Environment Variables**
   (same names/values as your local `.env`).
3. Deploy. Once you have the real `https://….vercel.app` URL, add it to Firebase's
   **Authentication → Settings → Authorized domains** (step 2 above) — Google sign-in
   will fail from that domain until it's added.

Every push to `main` (once connected) triggers a new Vercel deployment automatically —
no GitHub Actions workflow needed for that part; `.github/workflows/ci.yml` still runs
`typecheck` + `build` on every push/PR as a fast correctness check independent of Vercel.

## How it works

- **Auth** — email/password or Google via Firebase Authentication. Sessions persist
  across restarts, so returning users stay signed in until they explicitly sign out.
- **Data model** — everything lives under `users/{uid}/...` in Firestore (`workplaces`,
  `timelists`, and each timelist's `entries` subcollection), so Firestore security
  rules can enforce "only the owner can read/write" once per subtree instead of a
  per-row policy. See `firestore.rules` and `src/lib/data.ts`.
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
