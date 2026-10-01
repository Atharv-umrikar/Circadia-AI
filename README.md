# ⚡ Circadia AI — Smart Body-Clock Day Planner

> A 10-second energy check-in that re-plans the rest of your day around your body clock.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?logo=googlegemini&logoColor=white)
![Web Bluetooth](https://img.shields.io/badge/Web_Bluetooth-0082FC?logo=bluetooth&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)

Built at **Async'26**, Track 2: Wellness & Lifestyle, by **The 3 PM Club**.

<!-- Add a screenshot or GIF of the app here -->
<!-- ![Circadia AI screenshot](docs/screenshot.png) -->

---

## 🧩 The Problem

Calendars and to-do apps plan your day as if your energy stayed flat from 9 to 6. It doesn't. After a bad night's sleep, too much coffee or the classic post-lunch slump, the plan you made that morning stops working, and you push through your hardest work at your lowest point.

## 💡 The Solution

Circadia AI asks four quick questions (energy, sleep, caffeine, screen time), optionally adds live vitals from a Bluetooth wearable, and gives you back:

1. **A diagnosis**: why your energy is where it is right now
2. **One thing to do in the next 15 minutes**
3. **A revised schedule** for the rest of your day, sorted by the time each block starts and matched to your body clock

It then learns your personal hourly energy baseline and runs **7-day experiments on yourself** (N-of-1 trials) to prove which habits actually fix *your* energy crashes.

---

## ✨ Features

| Feature | What it does |
|---|---|
| ⚡ **10-second check-in** | Energy (1–5), sleep, caffeine and screen-time sliders, plus demo presets: *Bad Sleep*, *3 PM Crash*, *Peak Morning* |
| 🧠 **AI Rebound Plan** | On submit, **Google Gemini** generates a personalised diagnosis, next action and schedule. A rule-based engine updates the plan instantly as you move the sliders and takes over if the AI is unavailable. |
| 📈 **Energy baseline chart** | Today's energy vs. your 14-day hour-by-hour baseline, with the post-lunch dip highlighted |
| 🧪 **N-of-1 experiments** | Test habits (e.g. a 90-minute caffeine delay or a post-lunch walk) and measure the change against your own baseline |
| ⌚ **Bluetooth wearable sync** | Pair straight from the browser, stream live heart rate, calculate HRV from beat-to-beat (RR) intervals, and read device battery and details |
| 📊 **Circadian summary** | Your best and worst hours, how often you crash in the afternoon, averages for sleep and caffeine |
| 🔎 **Check-in history** | Searchable, filterable, exportable list of every check-in |

---

## 🧠 How the AI Works

```
Check-in form ──► POST /api/checkins        (saves the check-in)
             └──► POST /api/circadian-plan
                        │
                        ├─ GEMINI_API_KEY set? ──► Gemini generates a JSON plan
                        │                          (diagnosis, next action, schedule)
                        │
                        └─ no key / error ───────► rule-based circadian engine
```

- **Gemini is called only when you press "Submit Check-In"**, one request (a few hundred tokens) per submit. Moving the sliders never calls the API.
- Every response includes a `source` field (`gemini-…` or `circadian_engine`), so you can always tell which one produced the plan.
- The rule engine (`src/utils/circadianEngine.ts`) builds its plan from the time of day (from the morning cortisol peak to the evening wind-down) plus sleep, energy, caffeine and screen-time thresholds. That means the app works fully offline and responds instantly.

---

## ⌚ Wearable Support

Circadia uses the browser's **Web Bluetooth API** and the standard Bluetooth health profiles:

| Service | UUID | Used for |
|---|---|---|
| Heart Rate | `0x180D` / `0x2A37` | Live BPM + RR intervals → real-time HRV (RMSSD) |
| Battery | `0x180F` / `0x2A19` | Device battery % (live if supported) |
| Device Information | `0x180A` | Manufacturer and model |

**Works well with:** Polar H10 / Verity / OH1, Garmin watches with *Broadcast Heart Rate* on, most chest straps, and Android HR-broadcast apps.

**Heads-up:** many consumer smartwatches (Apple Watch, Galaxy Watch, Pixel Watch) don't expose heart rate to browsers over standard Bluetooth. Any value a device doesn't send is shown as `--`, never guessed.

Requires **Chrome, Edge or Brave** on desktop or Android.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS, Lucide icons |
| Backend | Node.js, Express, TypeScript (`tsx`) |
| AI | Google Gemini via `@google/genai` |
| Hardware | Web Bluetooth API (GATT) |
| Build | Vite |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Chrome, Edge or Brave (for Bluetooth)
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/). Optional: the app runs without one.

### Install & Run

```bash
git clone https://github.com/<your-username>/circadia-ai.git
cd circadia-ai

npm install
# if you get a peer-dependency error:
# npm install --legacy-peer-deps

cp .env.example .env.local
# edit .env.local and set:
# GEMINI_API_KEY="your-key-here"

npm run dev
```

Open **http://localhost:3000** 🎉

### Check that Gemini is active
Submit a check-in, open DevTools → **Network** → `circadian-plan`, and look for `"source": "gemini-…"` in the response.

---

## 📁 Project Structure

```
circadia-ai/
├── server.ts                     # Express API, in-memory store, Gemini integration
├── index.html                    # HTML page the React app loads into
├── vite.config.ts                # Vite + React + Tailwind config
├── package.json
├── .env.example                  # Environment variable template
└── src/
    ├── main.tsx                  # React entry point
    ├── App.tsx                   # App state, API calls, layout
    ├── index.css                 # Tailwind + custom styles
    ├── types/circadia.ts         # Shared TypeScript types
    ├── utils/circadianEngine.ts  # Rule-based plan engine (instant + fallback)
    └── components/
        ├── Header.tsx               # Top bar, watch status, demo reset
        ├── CheckInSidebar.tsx       # Check-in form + presets
        ├── ReboundPlanView.tsx      # Diagnosis, next action, schedule
        ├── EnergyBaselineChart.tsx  # Today vs. 14-day baseline
        ├── ExperimentsList.tsx      # N-of-1 trial results
        ├── NewExperimentModal.tsx   # Create a new trial
        ├── CircadianSummaryView.tsx # Analytics
        ├── LedgerSearchView.tsx     # Check-in history
        └── WatchImportModal.tsx     # Bluetooth pairing + live vitals
```

---

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/checkins` | List all check-ins |
| `POST` | `/api/checkins` | Create a check-in |
| `POST` | `/api/circadian-plan` | Generate the Rebound Plan (Gemini → rule-engine fallback) |
| `GET` | `/api/circadian-summary` | Hourly baseline, best/worst hours, crash count |
| `GET` | `/api/experiments` | List N-of-1 trials |
| `POST` | `/api/experiments` | Create a trial |
| `GET` | `/api/watch-status` | Current wearable data |
| `POST` | `/api/import-watch-data` | Save wearable metrics |
| `POST` | `/api/disconnect-watch` | Clear wearable connection |
| `POST` | `/api/reset` | Reset to demo data |

---

## ⚠️ Known Limitations

- **In-memory storage**: data resets when the server restarts. It is seeded with 14 days of sample data for the demo.
- **Single user**: no accounts or authentication yet.
- **Wearables**: limited to devices that expose standard Bluetooth health services (see above).
- **Not a medical device**: recommendations are general wellness guidance, not medical advice.

---

## 🗺 Roadmap

- [ ] Personal ML model trained on your check-in history to predict energy by hour
- [ ] Describe your check-in in plain words and have it filled in for you
- [ ] Persistent database + user accounts
- [ ] Apple Health / Google Fit / Garmin Connect import
- [ ] Calendar integration to reschedule meetings automatically around energy dips

---

## 👥 Team — The 3 PM Club

| Name | Role | GitHub |
|---|---|---|
| _Name_ | _Role_ | [@handle](https://github.com/) |
| _Name_ | _Role_ | [@handle](https://github.com/) |

---

<p align="center">Built with ☕ (delayed by 90 minutes) at Async'26</p>

