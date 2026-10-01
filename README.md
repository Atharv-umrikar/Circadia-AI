# ⚡ Circadia AI — Your AI Energy & Productivity Coach

> **Don't just track your energy. Test what fixes it.**
> A 10-second check-in that re-plans the rest of your day around your body clock, then measures whether the plan actually worked.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?logo=googlegemini&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)

Built at **Async'26**, Track 2: Wellness & Lifestyle, by **The 3 PM Club**.

🔗 **Live app:** https://circadia-ai-chronobiological-day-re-planner.ai.studio

---

## 📑 Contents

1. [What Circadia does](#-what-circadia-does)
2. [Option A: use the live app (AI Studio)](#-option-a-use-the-live-app-ai-studio)
3. [Option B: run it locally](#-option-b-run-it-locally)
   - [Requirements](#requirements)
   - [Step-by-step setup](#step-by-step-setup)
   - [Production build](#production-build)
   - [Environment variables](#environment-variables)
4. [How to operate the app](#-how-to-operate-the-app)
5. [How the AI works](#-how-the-ai-works)
6. [Wearable support](#-wearable-support)
7. [Project structure](#-project-structure)
8. [API reference](#-api-reference)
9. [Troubleshooting](#-troubleshooting)
10. [Known limitations](#-known-limitations)
11. [Team](#-team--the-3-pm-club)

---

## 🧩 What Circadia does

Calendars plan your day as if your energy stayed flat from 9 to 6. It doesn't. Circadia closes the loop between how you feel and what you should do next:

1. **Check in** (10 seconds): energy (1–5), sleep, caffeine, screen time and time of day.
2. **Diagnose**: why your energy is where it is right now, compared with your own baseline for that hour.
3. **Prescribe**: one action for the next 15 minutes, plus a re-timed schedule of micro-activities for the rest of the day.
4. **Feedback**: tick off what you did and check in again; Circadia measures the change.
5. **Improve**: habits become 7-day personal (N-of-1) trials, scored by how much they actually lifted *your* energy.

---

## 🌐 Option A: use the live app (AI Studio)

No installation needed. Works in any modern browser on desktop or mobile.

1. Open **https://circadia-ai-chronobiological-day-re-planner.ai.studio**
2. On the sign-in screen, pick one of the demo profiles (the demo password is pre-filled) or **create your own account** with your name, email, chronotype and target sleep.
3. Follow [How to operate the app](#-how-to-operate-the-app) below.

**Notes for the hosted version**

- The hosted app runs the Gemini-powered plan out of the box; the API key is managed in AI Studio, so you don't need your own.
- Data is held in server memory. It can reset when the hosted instance restarts, so treat it as a demo, not long-term storage.
- For Bluetooth wearable pairing, use **Chrome, Edge or Brave** (see [Wearable support](#-wearable-support)).

**Editing or redeploying from AI Studio (project owners)**

1. Open the project in [Google AI Studio](https://aistudio.google.com/).
2. Add your Gemini key under **Secrets** as `GEMINI_API_KEY`. AI Studio injects it (and `APP_URL`) at runtime, so it never needs to be committed.
3. Deploy or redeploy from AI Studio to update the live link.

---

## 💻 Option B: run it locally

### Requirements

| Requirement | Version / details | Why it's needed |
|---|---|---|
| **Node.js** | **20.19+ or 22.12+** (22 LTS recommended) | Vite 8 and the React plugin require it. Check with `node -v`. |
| **npm** | 10+ (ships with Node 20/22) | Installs dependencies. Check with `npm -v`. |
| **Git** | Any recent version | Cloning the repository. |
| **Browser** | Chrome, Edge or Brave (latest) recommended; Firefox/Safari work except Bluetooth | The UI; Web Bluetooth for wearables is Chromium-only. |
| **Gemini API key** | *Optional*, free from [Google AI Studio → Get API key](https://aistudio.google.com/apikey) | Enables AI-written plans. Without it, the built-in rule engine produces every plan. |
| **Internet** | Needed for `npm install`, Gemini calls and web fonts | The app itself runs fine offline in rule-engine mode once installed. |
| **Port** | `3000` free (configurable with `PORT`) | The Express server serves both the API and the UI. |
| **OS** | Windows 10/11, macOS or Linux | Any OS that runs Node.js. |
| **Disk** | ~300 MB for `node_modules` | Dependencies. |

### Step-by-step setup

**1. Clone the repository**

```bash
git clone https://github.com/nem7195/Circadia-AI.git
cd Circadia-AI
```

**2. Install dependencies**

```bash
npm install
```

> If you see an `ERESOLVE` peer-dependency error, run `npm install --legacy-peer-deps` instead.

**3. Add your Gemini API key (optional)**

Create a file named `.env` in the project root (the server loads `.env` via `dotenv`):

```bash
# macOS / Linux
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

Then edit `.env`:

```env
GEMINI_API_KEY="your-gemini-api-key"
```

> ⚠️ Never commit `.env`. It is already covered by `.gitignore` (`.env*`). Skip this step entirely to run in rule-engine mode.

**4. Start the app**

```bash
npm run dev
```

You should see:

```
Circadia AI Server running on http://localhost:3000
```

**5. Open it**

Go to **http://localhost:3000** in your browser and sign in with a demo profile (see [How to operate the app](#-how-to-operate-the-app)).

**6. Confirm Gemini is active (optional)**

Submit a check-in, open DevTools → **Network** → `circadian-plan`, and check the response's `source` field: `gemini-…` means the AI wrote the plan; `circadian_engine` means the rule engine did.

### Production build

```bash
npm run build                          # bundles the frontend into dist/

# macOS / Linux
NODE_ENV=production npm start

# Windows (PowerShell)
$env:NODE_ENV="production"; npm start
```

In production mode the Express server serves the pre-built files from `dist/` instead of running Vite in dev mode.

### Available scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the Express API with Vite dev middleware on port 3000 |
| `npm start` | Same server; serves `dist/` when `NODE_ENV=production` |
| `npm run build` | Builds the production frontend into `dist/` |
| `npm run preview` | Previews the built frontend with Vite (UI only, no API) |
| `npm run lint` | Type-checks the project (`tsc --noEmit`) |
| `npm run clean` | Removes `dist/` (macOS/Linux shell) |

### Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | No | none | Enables Gemini-generated plans. Falls back to the rule engine when missing or on error. |
| `PORT` | No | `3000` | Server port. |
| `NODE_ENV` | No | development | Set to `production` to serve the built `dist/` folder. |
| `DISABLE_HMR` | No | `false` | Disables hot reload / file watching (used by AI Studio). |
| `APP_URL` | No | none | Injected by AI Studio with the hosted URL; not needed locally. |

---

## 🧭 How to operate the app

### 1. Sign in

Choose a demo profile (password pre-filled) or create an account. Each profile has its own chronotype, sleep target and data.

| Profile | Chronotype | Email | Demo password |
|---|---|---|---|
| Dr. Sarah Chen | Early Bird (Lark) | sarah.chen@circadia.io | `sarah123` |
| Alex Rivera | Night Owl | alex.rivera@circadia.io | `alex123` |
| Marcus Vance | Intermediate | marcus.vance@circadia.io | `marcus123` |

> Demo credentials are for the hackathon demo only. Replace them before any real deployment.

### 2. Check in (Today's Plan tab)

Set your **energy (1–5)**, **hours slept**, **caffeine servings**, **screen time** and **check-in hour**, or tap a preset:

| Preset | Scenario |
|---|---|
| 😴 **3 PM Slump** | 3 PM, energy 1, 5.5 h sleep, 2 coffees, 4.5 h screens |
| 🌙 **Bad Sleep** | 8 AM, energy 2, 4.5 h sleep |
| ⚡ **Peak Alert** | 10 AM, energy 5, 8 h sleep |

Press **"Re-Plan My Day Around My Body Clock"**.

### 3. Follow your Rebound plan

You get:

- **Diagnosis**: what is pulling your energy down right now.
- **Next 15 minutes**: one concrete action (e.g. cold water, daylight, hold the next coffee).
- **Re-timed schedule**: micro-activities in time order, such as hardest task now, a walk before the 2 PM dip, lighter work later, a caffeine cutoff.

### 4. Close the loop

Tick off micro-activities as you do them and **check in again later**. Each check-in is compared with your hourly baseline, so you can see whether the plan actually moved your energy.

### 5. Explore the other tabs

| Tab | What you'll find |
|---|---|
| **Today's Plan** | Check-in form, Rebound plan and schedule |
| **Energy Curve** | Today vs. your 14-day hour-by-hour baseline, peak and dip hours |
| **Habit Trials** | 7-day N-of-1 experiments with the measured energy change per habit; start your own |
| **30-Day Journal** | Day-by-day ledger of improved, steady and dipped days, plus streaks |
| **Logs** | Searchable history of every check-in |

### 6. Connect a wearable (optional)

Open the watch/Bluetooth option, choose your device type and pair. Live heart rate, HRV and battery appear when the device supports standard Bluetooth health profiles.

---

## 🧠 How the AI works

```
Check-in ──► POST /api/checkins          (saves the check-in)
        └──► POST /api/circadian-plan
                   │
                   ├─ GEMINI_API_KEY set ─► Gemini returns a JSON plan
                   │                        (diagnosis, next action, schedule)
                   │
                   └─ no key / error ─────► rule-based circadian engine
```

- A **rule-based circadian engine** decides the actions from time of day (morning peak → afternoon dip → evening wind-down) plus sleep, energy, caffeine and screen-time thresholds, so plans stay safe and explainable.
- **Gemini** personalises the plan for your exact inputs. It is called only when you submit a check-in, never while you move the sliders.
- **Privacy:** only the five check-in values are sent to the AI, never your name, email or raw wearable data.
- Every plan response includes a `source` field so you can tell which path produced it.

---

## ⌚ Wearable support

Circadia uses the browser's **Web Bluetooth API** with the standard health profiles:

| Service | UUID | Used for |
|---|---|---|
| Heart Rate | `0x180D` / `0x2A37` | Live BPM and RR intervals → real-time HRV (RMSSD) |
| Battery | `0x180F` / `0x2A19` | Device battery % |
| Device Information | `0x180A` | Manufacturer and model |

- **Works well with:** Polar H10 / Verity / OH1, Garmin watches with *Broadcast Heart Rate* enabled, most chest straps, Android HR-broadcast apps.
- **Limited:** Apple Watch, Galaxy Watch and Pixel Watch don't expose heart rate to browsers over standard Bluetooth. Values a device doesn't send show as `--` and are never guessed.
- **Browser:** Chrome, Edge or Brave on desktop or Android. Web Bluetooth only works on `https://` or `http://localhost`, and your computer's Bluetooth must be switched on.

---

## 📁 Project structure

```
Circadia-AI/
├── server.ts                  # Express API, in-memory data store, Gemini integration, rule engine
├── index.html                 # HTML shell the React app mounts into
├── vite.config.ts             # Vite + React + Tailwind configuration
├── metadata.json              # AI Studio app metadata
├── package.json / package-lock.json
├── tsconfig.json
├── .env.example               # Environment variable template (copy to .env)
└── src/
    ├── main.tsx               # React entry point
    ├── App.tsx                # App state, routing between tabs, layout
    ├── index.css              # Tailwind + custom styles
    ├── types.ts               # Shared TypeScript types
    ├── services/
    │   ├── api.ts             # Client for the Express API
    │   └── bluetooth.ts       # Web Bluetooth pairing + live vitals
    └── components/
        ├── LoginPortal.tsx        # Sign in / create account
        ├── Navbar.tsx             # Top navigation tabs
        ├── QuickCheckIn.tsx       # Check-in form + presets
        ├── PlanCard.tsx           # Diagnosis, next action, schedule
        ├── BaselineChart.tsx      # Today vs. 14-day baseline
        ├── CircadianSummaryCard.tsx
        ├── ExperimentsView.tsx    # 7-day habit trials
        ├── MonthlyLedgerView.tsx  # 30-day journal
        ├── HistoryView.tsx        # Check-in logs
        ├── WatchModal.tsx         # Wearable pairing
        ├── UserModal.tsx          # Profile management
        ├── CircadiaLogo.tsx, GeminiBackground.tsx, ErrorBoundary.tsx
```

---

## 🔌 API reference

All user-scoped requests send the signed-in user in the `x-user-id` header.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/auth/users` | List profiles available to sign in |
| `GET` | `/api/auth/me` | Current user |
| `POST` | `/api/auth/login` | Sign in with email/user ID and password |
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/switch-user` | Switch active profile |
| `GET` | `/api/checkins` | List check-ins |
| `POST` | `/api/checkins` | Create a check-in |
| `DELETE` | `/api/checkins/:id` | Delete a check-in |
| `POST` | `/api/circadian-plan` | Generate the Rebound plan (Gemini → rule-engine fallback) |
| `GET` | `/api/circadian-summary` | Hourly baseline, peak/dip hours, crash count |
| `GET` | `/api/monthly-ledger` | 30-day journal data |
| `GET` | `/api/experiments` | List habit trials |
| `POST` | `/api/experiments` | Create a trial |
| `DELETE` | `/api/experiments/:id` | Delete a trial |
| `GET` | `/api/watch-status` | Current wearable data |
| `POST` | `/api/import-watch-data` | Save wearable metrics |
| `POST` | `/api/disconnect-watch` | Disconnect the wearable |
| `POST` | `/api/reset` | Reset the current user to demo data |

---

## 🛠 Troubleshooting

| Problem | Fix |
|---|---|
| `npm install` fails with `ERESOLVE` | Run `npm install --legacy-peer-deps`. |
| `Unsupported engine` or Vite crashes on start | Upgrade Node to 20.19+ or 22.12+ (`node -v`). |
| `EADDRINUSE: address already in use :::3000` | Another app is using the port. Run on another port: `PORT=3001 npm run dev` (PowerShell: `$env:PORT=3001; npm run dev`). |
| Plans say `source: circadian_engine` | No valid `GEMINI_API_KEY` in `.env` (note: `.env.local` is not read locally), or the key hit a quota. Restart the server after editing `.env`. |
| Bluetooth button does nothing | Use Chrome/Edge/Brave, open via `localhost` or `https`, and turn on your computer's Bluetooth. |
| Data disappeared | Storage is in memory and resets on server restart; use **Reset** to reload demo data. |
| Fonts look different offline | Web fonts load from Google Fonts; the app falls back to system fonts without internet. |

---

## ⚠️ Known limitations

- **In-memory storage:** data resets when the server restarts. Each demo profile is seeded with sample history.
- **Demo-grade accounts:** passwords are stored in plain text in server memory; not production authentication.
- **Projected energy lift is modelled**, based on the rule engine; real effect per person is measured through repeat check-ins and 7-day trials.
- **Wearables:** limited to devices that expose standard Bluetooth health services.
- **Not a medical device:** recommendations are general wellness guidance, not medical advice.

---

## 🗺 Roadmap

- [ ] Automatic re-ranking of micro-activities from each user's own results
- [ ] Persistent database and secure authentication
- [ ] Mobile app
- [ ] Passive signals: phone screen time, calendar, Apple Health / Google Fit / Garmin Connect
- [ ] Calendar integration to move demanding work away from predicted dips

---

## 👥 Team — The 3 PM Club

| Name | Role |
|---|---|
| Atharv Umrikar | Team lead |
| Naman Gaud | Team member |
| Ninaad Bardapurkar | Team member |

---

<p align="center">Built with ☕ (delayed by 90 minutes) at Async'26</p>
