# D31.UNIVERSE PRO

Darshan Chavda's fitness app. Train smart, move better. It's a mobile-first PWA in English, हिन्दी and ગુજરાતી.

Stack: React 19, TypeScript, Vite, Tailwind 4, Zustand, Supabase (Auth, Postgres with RLS, Storage, Edge Functions), Gemini (server-side only, using the D31 Core Engine prompt), MediaPipe Pose and Razorpay.

---

## What's inside

| Area | What it does |
|---|---|
| **Onboarding** | Asks for language (EN/HI/GU), goal, level, equipment, days per week and body stats, then picks a starter program |
| **Today** | Today's workout, streak, weekly ring, readiness score, launch offer and quick actions |
| **Train** | 10 programs: Foundation, Mobility 15, Home Burn, PPL, Upper/Lower, 5×5, Handstand, Front Lever, Dragon Flag and Human Flag. Also a custom workout builder |
| **Workout player** | Elapsed timer, set logging (reps/kg), automatic rest timer with ±15 s, swap and add exercises, resume bar, a summary with new PRs |
| **Library** | 36 exercises with search and filters (category, level, equipment, muscle). Each detail page has a front/back anatomy map (flat solid tint, no glow), steps, cues, common mistakes and benefits. Also includes D31 knowledge posts |
| **Analyze** | **Form check:** upload photos or video plus a question. Gemini runs in a Supabase Edge Function and returns clean cards (verdict / good / fix / cue / safety). Photos get a thin skeleton and joint-angle overlay.<br>**Live reps:** MediaPipe on-device rep counter for squats and push-ups, with voice count |
| **Progress** | History, charts (volume and frequency), body measurements, PRs (Epley e1RM), progress photos with side-by-side compare (Pro) |
| **Fuel** | Calorie and macro calculator (Mifflin-St Jeor), a quick Indian food log and water. Recovery check-in (sleep, energy, soreness, stress) feeds the readiness score |
| **Profile** | Language, units, rest default, sound, reminders, data export/reset, account, membership, legal |
| **Membership** | Free, Pro ₹149, Premium ₹499 and Coaching ₹1,499 per month. Launch offer: the first 131 members get Pro free for 1 month; after that, a 7-day trial. Payment goes through Razorpay |
| **Legal** | Privacy, Terms, Not-medical-advice disclaimer, Refunds/Cancellation, Contact (Razorpay needs these) |
| **PWA** | Manifest, icons (including maskable), offline service worker, installable, SEO/OG/JSON-LD |

### DEMO mode
If `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are missing, the app runs in **DEMO mode**:
- A yellow banner is shown at the top.
- All data stays in the browser.
- Form analysis returns a clearly labelled sample result.
- Payments are simulated.

Everything else works fully.

---

## Run locally

```bash
npm install
cp .env.example .env    # leave empty for DEMO mode
npm run dev             # http://localhost:5173
npm run typecheck
npm run build           # outputs dist/
npm test                # logic tests + migrations/RLS tests (in-memory Postgres via PGlite)
```

---

## Go live: Supabase + Vercel/Netlify

### 1. Supabase
1. Create a project at supabase.com. Copy the **Project URL** and **anon key** (Settings → API).
2. Apply the database. Install the Supabase CLI, then run:
   ```bash
   supabase login
   supabase link --project-ref YOUR_REF
   supabase db push          # runs supabase/migrations/0001..0003
   ```
   If you'd rather not use the CLI, paste each file in `supabase/migrations/` into the SQL Editor, in order.
3. Set the server secrets. **These never go in the frontend:**
   ```bash
   supabase secrets set GEMINI_API_KEY=your_key GEMINI_MODEL=gemini-2.5-flash
   supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxx RAZORPAY_KEY_SECRET=xxx
   supabase secrets set ALLOWED_ORIGIN=https://your-domain.com
   ```
4. Deploy the functions:
   ```bash
   supabase functions deploy analyze-media
   supabase functions deploy razorpay-create-order
   supabase functions deploy razorpay-verify
   ```
5. Set up auth:
   - Under Authentication → URL Configuration, set the **Site URL** to your domain and add it under Redirect URLs.
   - Under Authentication → Providers → **Google**, enable it and paste the OAuth client ID and secret from Google Cloud Console. The authorised redirect URI is `https://YOUR_REF.supabase.co/auth/v1/callback`.
6. Make yourself admin, so you can manage D31 posts:
   ```sql
   update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
   ```

### 2. Vercel (or Netlify)
1. Push this folder to a GitHub repo.
2. In Vercel, choose **New Project** and import the repo. The settings are already in `vercel.json`. On Netlify, `netlify.toml` covers it.
3. Add these environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPPORT_EMAIL`, `VITE_BUSINESS_NAME`, and optionally `VITE_SOCIAL_*`.
4. Deploy. Then put the final domain into Supabase (Site URL, Redirect URLs) and into `ALLOWED_ORIGIN`.

The app uses hash routes (`/#/home`), so no rewrite rules are needed.

### 3. Razorpay
1. Sign up and finish KYC. Razorpay checks that your site shows the Contact, Terms, Privacy and Refund pages; they're built in under Profile → Legal.
2. Start with **test keys** (`rzp_test_…`). Buy a plan using a Razorpay test card. The plan becomes active only after the server verifies the signature.
3. Then switch the secrets to the live keys.

Prices are set **on the server** (`razorpay-create-order`). Each purchase is a one-month pass with no auto-renew.

---

## Bring it into Google AI Studio
AI Studio "Build" apps are a React + Vite project, so you can import this one:
1. In AI Studio, open your app (d31-universe) and open the code editor.
2. Upload or replace the files with this project's `src/`, `public/`, `index.html`, `package.json`, `vite.config.ts` and `tsconfig*.json`. Alternatively, connect the GitHub repo if your AI Studio workspace supports it.
3. **Don't** put the Gemini key in the frontend. AI analysis goes through the Supabase `analyze-media` function, so do the Supabase steps above and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in AI Studio's environment settings.
4. Add `https://d31-universe.ai.studio` to the Supabase Redirect URLs and to `ALLOWED_ORIGIN`.
5. Publish from AI Studio. With no Supabase keys, it publishes in DEMO mode.

---

## Project structure
```
src/
  screens/      Home, Train, ProgramDetail, Builder, Player, Library, ExerciseDetail,
                Analyze (form check + live reps), Progress, Fuel, Profile, Membership, Legal, Auth, Onboarding
  components/   ui kit, BodyMap (anatomical SVG), Charts, Brand, OfferBanner, ExercisePicker
  data/         exercises (36), programs (10), foods, posts
  i18n/         EN / HI / GU strings (typed — a missing key fails the build)
  lib/          supabase, cloud sync, pose (MediaPipe), analyze, payments, plans, workout, router
  lib/engine/   d31CoreEngine.ts (your prompt, unchanged)
  store/        Zustand store (local-first, synced to Supabase when signed in)
supabase/
  migrations/   0001 posts · 0002 app schema + RLS + offer/trial RPCs · 0003 exercise seed
  functions/    analyze-media · razorpay-create-order · razorpay-verify
public/         manifest, service worker, icons, og-image
scripts/        gen-seed, test-logic, test-migrations
screenshots/    390×844 mobile screenshots
```

## Security notes
- The Gemini and Razorpay secrets live only in Supabase function secrets.
- Every table has Row Level Security: users can only see their own rows.
- Users can't change their own `role`, plan or subscription. Only server functions (service role) and the guarded RPCs can.
- The AI analysis quota is enforced on the server each month: Free 3, Pro 30, Premium 100, Coaching 300.
- Progress photos go to a **private** storage bucket, in a per-user folder.

## Known limitations
- Exercise and program descriptions and the legal text are in English. All app UI is translated into HI and GU.
- Have a lawyer review the legal pages before you take payments.
- Razorpay is set up as monthly passes, not auto-renewing subscriptions, and has no webhook yet.
- The exercise library uses diagrams, not videos.
- The live rep counter needs good light and a side view of the whole body. It supports squats and push-ups.
