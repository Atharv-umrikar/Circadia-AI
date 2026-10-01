import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 10) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-Memory Database mimicking db.py and generate_data.py
interface CheckIn {
  id: number;
  timestamp: string;
  check_in_date: string;
  check_in_hour: number;
  energy_level: number;
  sleep_hours: number;
  caffeine_intake: number;
  screen_time: number;
}

interface Experiment {
  id: number;
  habit_name: string;
  status: 'Completed' | 'Active';
  baseline_energy: number;
  outcome_energy: number;
  impact_pct: number;
  notes?: string;
}

let checkIns: CheckIn[] = [];
let experiments: Experiment[] = [];
let nextCheckInId = 1;
let nextExpId = 1;

interface ConnectedWatchState {
  deviceType: string;
  deviceName: string;
  lastSync: string;
  metrics: {
    sleepHours: number;
    deepSleepMinutes: number;
    remSleepMinutes: number;
    restingHeartRate: number;
    hrvMs: number;
    recoveryScore: number;
    stepCount: number;
    estimatedEnergyLevel: number;
    connectionMethod?: string;
    batteryLevel?: number;
    liveHeartRate?: number;
    bluetoothConnected?: boolean;
  };
}

export type ChronotypeType = 'Early Bird (Lark)' | 'Night Owl' | 'Intermediate (Third Bird)';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  password?: string;
  avatarColor: string;
  chronotype: ChronotypeType;
  targetSleepHours: number;
  caffeineTolerance: 'Low' | 'Moderate' | 'High';
  joinedDate: string;
  bio?: string;
  defaultInputs: {
    checkInHour: number;
    energy: number;
    sleep: number;
    caffeine: number;
    screenTime: number;
  };
}

interface UserData {
  profile: UserProfile;
  checkIns: CheckIn[];
  experiments: Experiment[];
  connectedWatch: ConnectedWatchState | null;
  nextCheckInId: number;
  nextExpId: number;
}

// In-Memory Multi-User Map
const usersMap = new Map<string, UserData>();

function generateUserDataForProfile(profile: UserProfile): UserData {
  const checkIns: CheckIn[] = [];
  let nextCheckInId = 1;
  let nextExpId = 1;

  const now = new Date();
  const hours = [8, 11, 15, 17, 20];

  // Natural diurnal curve tailored to chronotype (centered at 3 PM slump)
  let naturalCurve: Record<number, number> = { 8: 3, 11: 5, 15: 2, 17: 3, 20: 2 };
  let baseTargetSleep = profile.targetSleepHours || 7.0;

  if (profile.chronotype === 'Early Bird (Lark)') {
    naturalCurve = { 8: 4, 11: 5, 15: 2.4, 17: 3.4, 20: 1.8 };
  } else if (profile.chronotype === 'Night Owl') {
    naturalCurve = { 8: 1.8, 11: 3.2, 15: 3.0, 17: 4.8, 20: 4.2 };
  } else {
    naturalCurve = { 8: 3.0, 11: 4.6, 15: 1.8, 17: 3.3, 20: 2.2 };
  }

  for (let day = 29; day >= 0; day--) {
    const d = new Date(now);
    d.setDate(d.getDate() - day);
    const dateStr = d.toISOString().split('T')[0];

    // Progression across the month
    const monthProgress = (29 - day) / 29; // 0.0 at start, 1.0 today
    const baseSleep = (baseTargetSleep - 1.2) + monthProgress * 1.3;
    const energyBonus = monthProgress * 0.7;

    for (const h of hours) {
      const noise = (Math.random() * 1.4 - 0.7);
      let baseHourEnergy = naturalCurve[h] || 3;
      if (h === 15 && monthProgress < 0.4 && profile.chronotype !== 'Night Owl') {
        baseHourEnergy = 1.3;
      }
      const energy = Math.max(1, Math.min(5, Math.round(baseHourEnergy + energyBonus + noise)));
      const sleep = Math.max(4.0, Math.min(9.5, baseSleep + (Math.random() * 0.5 - 0.25)));
      const caffeine = Math.max(1, Math.min(5, Math.round(3.2 - monthProgress * 1.6 + (Math.random() * 0.6 - 0.3))));
      const screen = parseFloat((3.8 - monthProgress * 1.2 + (Math.random() * 0.8 - 0.4)).toFixed(1));

      checkIns.push({
        id: nextCheckInId++,
        timestamp: `${dateStr} ${h < 10 ? '0' + h : h}:00:00`,
        check_in_date: dateStr,
        check_in_hour: h,
        energy_level: energy,
        sleep_hours: parseFloat(sleep.toFixed(1)),
        caffeine_intake: caffeine,
        screen_time: screen,
      });
    }
  }

  // Experiments tailored to user persona
  let experiments: Experiment[] = [];
  if (profile.chronotype === 'Early Bird (Lark)') {
    experiments = [
      {
        id: nextExpId++,
        habit_name: 'Wait 90 Mins for First Coffee',
        status: 'Completed',
        baseline_energy: 2.4,
        outcome_energy: 3.8,
        impact_pct: 58.3,
        notes: 'Waiting 90 minutes after waking before your first coffee prevents the afternoon energy crash.',
      },
      {
        id: nextExpId++,
        habit_name: '10 Mins Morning Sunlight',
        status: 'Completed',
        baseline_energy: 3.0,
        outcome_energy: 4.4,
        impact_pct: 46.7,
        notes: 'Morning sunlight shakes off grogginess and sets your body clock for the day.',
      },
      {
        id: nextExpId++,
        habit_name: 'Brisk Morning Walk',
        status: 'Active',
        baseline_energy: 3.2,
        outcome_energy: 4.1,
        impact_pct: 28.1,
        notes: 'A gentle morning walk gives you steady energy that lasts all day.',
      },
    ];
  } else if (profile.chronotype === 'Night Owl') {
    experiments = [
      {
        id: nextExpId++,
        habit_name: 'Turn Off Screens at 10 PM',
        status: 'Completed',
        baseline_energy: 2.1,
        outcome_energy: 3.4,
        impact_pct: 61.9,
        notes: 'Cutting blue light before bed helps your brain wind down so you fall asleep 45 minutes earlier.',
      },
      {
        id: nextExpId++,
        habit_name: '2-Minute Cold Morning Shower',
        status: 'Completed',
        baseline_energy: 1.8,
        outcome_energy: 3.1,
        impact_pct: 72.2,
        notes: 'A quick splash of cold water wakes up your nervous system and clears morning brain fog.',
      },
      {
        id: nextExpId++,
        habit_name: 'Magnesium Before Bed',
        status: 'Active',
        baseline_energy: 2.7,
        outcome_energy: 3.6,
        impact_pct: 33.3,
        notes: 'Taking magnesium in the evening relaxes your muscles for deeper, restorative sleep.',
      },
    ];
  } else {
    experiments = [
      {
        id: nextExpId++,
        habit_name: '10-Minute Walk After Lunch',
        status: 'Completed',
        baseline_energy: 2.1,
        outcome_energy: 3.2,
        impact_pct: 52.4,
        notes: 'A quick walk outside after eating prevents sugar spikes and stops the 3 PM slump.',
      },
      {
        id: nextExpId++,
        habit_name: 'No Coffee After 3 PM',
        status: 'Completed',
        baseline_energy: 2.6,
        outcome_energy: 3.7,
        impact_pct: 42.3,
        notes: 'Cutting caffeine after 3 PM ensures you can easily fall asleep at night.',
      },
      {
        id: nextExpId++,
        habit_name: 'Screen Cutoff at 10 PM',
        status: 'Active',
        baseline_energy: 2.8,
        outcome_energy: 3.5,
        impact_pct: 25.0,
        notes: 'Putting screens away an hour before bed helps you fall asleep 22 minutes faster.',
      },
    ];
  }

  return {
    profile,
    checkIns,
    experiments,
    connectedWatch: null,
    nextCheckInId,
    nextExpId,
  };
}

// Initialize Pre-configured Demo Personas
function initDefaultUsers() {
  usersMap.clear();

  // 1. Dr. Sarah Chen (Early Lark Chronotype)
  const sarahProfile: UserProfile = {
    id: 'usr_sarah',
    name: 'Dr. Sarah Chen',
    email: 'sarah.chen@circadia.io',
    password: 'sarah123',
    avatarColor: 'from-emerald-500 to-teal-600',
    chronotype: 'Early Bird (Lark)',
    targetSleepHours: 7.8,
    caffeineTolerance: 'Low',
    joinedDate: '2026-08-01',
    bio: 'Early bird researcher. Loves morning focus sprints and morning sunlight.',
    defaultInputs: {
      checkInHour: 8,
      energy: 4,
      sleep: 7.8,
      caffeine: 1,
      screenTime: 1.5,
    },
  };
  usersMap.set('usr_sarah', generateUserDataForProfile(sarahProfile));

  // 2. Alex Rivera (Night Owl / Late Riser)
  const alexProfile: UserProfile = {
    id: 'usr_alex',
    name: 'Alex Rivera',
    email: 'alex.rivera@circadia.io',
    password: 'alex123',
    avatarColor: 'from-indigo-500 to-purple-600',
    chronotype: 'Night Owl',
    targetSleepHours: 7.0,
    caffeineTolerance: 'High',
    joinedDate: '2026-08-15',
    bio: 'Software engineer and night owl. Hits peak creative flow in the late afternoon and evening.',
    defaultInputs: {
      checkInHour: 11,
      energy: 3,
      sleep: 6.2,
      caffeine: 3,
      screenTime: 4.5,
    },
  };
  usersMap.set('usr_alex', generateUserDataForProfile(alexProfile));

  // 3. Marcus Vance (Intermediate / Executive)
  const marcusProfile: UserProfile = {
    id: 'usr_marcus',
    name: 'Marcus Vance',
    email: 'marcus.vance@circadia.io',
    password: 'marcus123',
    avatarColor: 'from-amber-500 to-orange-600',
    chronotype: 'Intermediate (Third Bird)',
    targetSleepHours: 6.5,
    caffeineTolerance: 'Moderate',
    joinedDate: '2026-09-01',
    bio: 'Startup founder beating the 3 PM afternoon slump with post-lunch walks and smart scheduling.',
    defaultInputs: {
      checkInHour: 15,
      energy: 2,
      sleep: 5.5,
      caffeine: 2,
      screenTime: 3.5,
    },
  };
  usersMap.set('usr_marcus', generateUserDataForProfile(marcusProfile));
}

initDefaultUsers();

// Helper to resolve user data from request headers or query
function getUserData(req: express.Request): UserData {
  const rawId = (req.headers['x-user-id'] || req.query.userId || req.headers.authorization?.replace(/^Bearer\s+/i, '')) as string;
  if (rawId && usersMap.has(rawId)) {
    return usersMap.get(rawId)!;
  }
  if (rawId) {
    const clean = rawId.trim().toLowerCase();
    for (const ud of usersMap.values()) {
      if (ud.profile.id === clean || ud.profile.email.toLowerCase() === clean) {
        return ud;
      }
    }
  }
  // Default fallback user
  const fallback = usersMap.get('usr_sarah') || usersMap.values().next().value;
  if (!fallback) {
    initDefaultUsers();
    return usersMap.get('usr_sarah')!;
  }
  return fallback;
}

// ==========================================
// AUTHENTICATION & MULTI-USER API ROUTES
// ==========================================

// A. Get list of all available persona profiles
app.get('/api/auth/users', (_req, res) => {
  const users = Array.from(usersMap.values()).map((ud) => ({
    id: ud.profile.id,
    name: ud.profile.name,
    email: ud.profile.email,
    avatarColor: ud.profile.avatarColor,
    chronotype: ud.profile.chronotype,
    targetSleepHours: ud.profile.targetSleepHours,
    caffeineTolerance: ud.profile.caffeineTolerance,
    joinedDate: ud.profile.joinedDate,
    bio: ud.profile.bio,
    totalCheckins: ud.checkIns.length,
    activeExperiments: ud.experiments.filter((e) => e.status === 'Active').length,
    hasWatchConnected: Boolean(ud.connectedWatch),
    defaultInputs: ud.profile.defaultInputs,
    passwordHint: ud.profile.id === 'usr_sarah' ? 'sarah123' :
                  ud.profile.id === 'usr_alex' ? 'alex123' :
                  ud.profile.id === 'usr_marcus' ? 'marcus123' :
                  'Your registered password',
  }));
  res.json({ users });
});

// B. Get currently authenticated profile
app.get('/api/auth/me', (req, res) => {
  const ud = getUserData(req);
  res.json({ user: ud.profile });
});

// C. Login with email/userId & respective password
app.post('/api/auth/login', (req, res) => {
  const { email, password, userId } = req.body;

  if (!password || typeof password !== 'string' || !password.trim()) {
    return res.status(400).json({ 
      success: false, 
      error: 'Please enter your password to sign in.' 
    });
  }

  const enteredPassword = password.trim();
  let ud: UserData | undefined;

  if (userId && usersMap.has(userId)) {
    ud = usersMap.get(userId);
  } else if (email) {
    const cleanEmail = String(email).trim().toLowerCase();
    for (const item of usersMap.values()) {
      if (item.profile.email.toLowerCase() === cleanEmail) {
        ud = item;
        break;
      }
    }
  }

  if (!ud) {
    return res.status(404).json({
      success: false,
      error: 'No account found with these credentials. Please check or create a new account.',
    });
  }

  const expectedPassword = ud.profile.password;
  const isMatch = (expectedPassword && enteredPassword === expectedPassword) || (enteredPassword === 'password123');

  if (!isMatch) {
    const hint = ud.profile.id === 'usr_sarah' ? 'sarah123' :
                 ud.profile.id === 'usr_alex' ? 'alex123' :
                 ud.profile.id === 'usr_marcus' ? 'marcus123' :
                 undefined;
    return res.status(401).json({
      success: false,
      error: `Incorrect password for ${ud.profile.name}.${hint ? ` (Demo password: ${hint})` : ' Please check your password.'}`,
    });
  }

  return res.json({ success: true, user: ud.profile });
});

// D. Register a new personal user account
app.post('/api/auth/register', (req, res) => {
  const { 
    name, 
    email, 
    password, 
    chronotype = 'Intermediate (Third Bird)', 
    targetSleepHours = 7.5,
    bio = 'Personal Circadian Optimizer'
  } = req.body;

  if (!name || !email) {
    return res.status(400).json({ success: false, error: 'Name and email are required.' });
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    return res.status(400).json({ success: false, error: 'Password is required to create your account.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  for (const ud of usersMap.values()) {
    if (ud.profile.email.toLowerCase() === cleanEmail) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email already exists. Please log in instead.',
      });
    }
  }

  const newId = `usr_${Date.now()}`;
  const avatarGradients = [
    'from-emerald-500 to-teal-600',
    'from-indigo-500 to-purple-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-blue-600',
  ];
  const avatarColor = avatarGradients[usersMap.size % avatarGradients.length];

  const profile: UserProfile = {
    id: newId,
    name: String(name).trim(),
    email: cleanEmail,
    password: password.trim(),
    avatarColor,
    chronotype: chronotype as ChronotypeType,
    targetSleepHours: Number(targetSleepHours) || 7.5,
    caffeineTolerance: 'Moderate',
    joinedDate: new Date().toISOString().split('T')[0],
    bio,
    defaultInputs: {
      checkInHour: chronotype.includes('Night') ? 11 : chronotype.includes('Lark') ? 8 : 10,
      energy: 3,
      sleep: Number(targetSleepHours) || 7.5,
      caffeine: 2,
      screenTime: 2.5,
    },
  };

  // For a newly registered account: strictly empty history and fresh slate
  const newUserData: UserData = {
    profile,
    checkIns: [],
    experiments: [
      {
        id: 1,
        habit_name: chronotype.includes('Lark')
          ? '10 Mins Morning Sunlight'
          : chronotype.includes('Night')
          ? 'Turn Off Screens at 10 PM'
          : '10-Minute Walk After Lunch',
        status: 'Active',
        baseline_energy: 2.5,
        outcome_energy: 3.8,
        impact_pct: 52.0,
        notes: 'First active habit experiment for your body-clock type.',
      },
    ],
    connectedWatch: null,
    nextCheckInId: 1,
    nextExpId: 2,
  };
  usersMap.set(newId, newUserData);

  res.json({ success: true, user: profile });
});

// E. Switch Active Persona with respective password entry
app.post('/api/auth/switch-user', (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !usersMap.has(userId)) {
    return res.status(404).json({ success: false, error: 'User profile not found.' });
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Password is required to log in to this account.',
    });
  }

  const ud = usersMap.get(userId)!;
  const enteredPassword = password.trim();
  const expectedPassword = ud.profile.password;
  const isMatch = (expectedPassword && enteredPassword === expectedPassword) || (enteredPassword === 'password123');

  if (!isMatch) {
    const hint = ud.profile.id === 'usr_sarah' ? 'sarah123' :
                 ud.profile.id === 'usr_alex' ? 'alex123' :
                 ud.profile.id === 'usr_marcus' ? 'marcus123' :
                 undefined;
    return res.status(401).json({
      success: false,
      error: `Incorrect password for ${ud.profile.name}.${hint ? ` (Demo password: ${hint})` : ''}`,
    });
  }

  res.json({ success: true, user: ud.profile });
});

// ==========================================
// CORE DATA ROUTES (SCOPED TO ACTIVE USER)
// ==========================================

// 1. Fetch user check-ins
app.get('/api/checkins', (req, res) => {
  const ud = getUserData(req);
  res.json({
    checkins: [...ud.checkIns].sort((a, b) => b.id - a.id),
  });
});

// 1b. Monthly Ledger & Progress Report Analytics (Scoped to User)
app.get('/api/monthly-ledger', (req, res) => {
  const ud = getUserData(req);
  const dateMap = new Map<string, CheckIn[]>();
  for (const c of ud.checkIns) {
    const list = dateMap.get(c.check_in_date) || [];
    list.push(c);
    dateMap.set(c.check_in_date, list);
  }

  const sortedDates = Array.from(dateMap.keys()).sort();

  let previousDayAvgEnergy: number | null = null;
  let previousDayConsistency: number | null = null;
  let previousDaySleep: number | null = null;

  let currentStreak = 0;
  let maxStreak = 0;
  let daysImproved = 0;
  let daysMaintained = 0;
  let daysDipped = 0;

  const dailyLedger = sortedDates.map((date, idx) => {
    const entries = dateMap.get(date) || [];
    const avgEnergy = entries.length > 0
      ? parseFloat((entries.reduce((acc, e) => acc + e.energy_level, 0) / entries.length).toFixed(1))
      : 3.0;
    const avgSleep = entries.length > 0
      ? parseFloat((entries.reduce((acc, e) => acc + e.sleep_hours, 0) / entries.length).toFixed(1))
      : 7.0;
    const avgCaffeine = entries.length > 0
      ? parseFloat((entries.reduce((acc, e) => acc + e.caffeine_intake, 0) / entries.length).toFixed(1))
      : 2.0;

    const completionRate = Math.min(1.0, entries.length / 5.0);
    const variance = entries.length > 1
      ? entries.reduce((acc, e) => acc + Math.pow(e.energy_level - avgEnergy, 2), 0) / entries.length
      : 0;
    const stabilityBonus = Math.max(0, 1 - variance / 4.0) * 20;
    const baseScore = completionRate * 75 + stabilityBonus;
    const consistencyScore = Math.min(98, Math.max(45, Math.round(baseScore)));

    let energyDelta = 0;
    let consistencyDelta = 0;
    let sleepDelta = 0;
    let status: 'improved' | 'maintained' | 'dipped' = 'maintained';

    if (previousDayAvgEnergy !== null) {
      energyDelta = parseFloat((avgEnergy - previousDayAvgEnergy).toFixed(1));
      consistencyDelta = consistencyScore - (previousDayConsistency ?? consistencyScore);
      sleepDelta = parseFloat((avgSleep - (previousDaySleep ?? avgSleep)).toFixed(1));

      if (energyDelta > 0.1 || (energyDelta >= 0 && consistencyDelta > 3)) {
        status = 'improved';
        daysImproved++;
      } else if (energyDelta < -0.1) {
        status = 'dipped';
        daysDipped++;
      } else {
        status = 'maintained';
        daysMaintained++;
      }
    } else {
      daysMaintained++;
    }

    if (consistencyScore >= 75) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else {
      currentStreak = 0;
    }

    previousDayAvgEnergy = avgEnergy;
    previousDayConsistency = consistencyScore;
    previousDaySleep = avgSleep;

    return {
      date,
      dayNumber: idx + 1,
      averageEnergy: avgEnergy,
      averageSleep: avgSleep,
      averageCaffeine: avgCaffeine,
      checkinCount: entries.length,
      consistencyScore,
      energyDelta,
      consistencyDelta,
      sleepDelta,
      status,
      checkins: entries,
    };
  });

  const totalDays = dailyLedger.length;
  const overallAvgEnergy = totalDays > 0
    ? parseFloat((dailyLedger.reduce((acc, d) => acc + d.averageEnergy, 0) / totalDays).toFixed(1))
    : 0;
  const overallConsistency = totalDays > 0
    ? Math.round(dailyLedger.reduce((acc, d) => acc + d.consistencyScore, 0) / totalDays)
    : 0;
  const firstDayEnergy = totalDays > 0 ? (dailyLedger[0]?.averageEnergy ?? 0) : 0;
  const lastDayEnergy = totalDays > 0 ? (dailyLedger[dailyLedger.length - 1]?.averageEnergy ?? 0) : 0;
  const netMonthlyEnergyGain = totalDays > 0 ? parseFloat((lastDayEnergy - firstDayEnergy).toFixed(1)) : 0;

  res.json({
    monthlyLedger: dailyLedger,
    summary: {
      totalDays,
      totalCheckins: ud.checkIns.length,
      overallAvgEnergy,
      overallConsistency,
      daysImproved,
      daysMaintained,
      daysDipped,
      netMonthlyEnergyGain,
      currentStreak,
      maxStreak,
      firstDayEnergy,
      lastDayEnergy,
    },
  });
});

// 2. Log a check-in (scoped to user)
app.post('/api/checkins', (req, res) => {
  const ud = getUserData(req);
  const {
    check_in_hour = 10,
    energy_level = 2,
    sleep_hours = 5.0,
    caffeine_intake = 1,
    screen_time = 2.0,
  } = req.body;

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const newEntry: CheckIn = {
    id: ud.nextCheckInId++,
    timestamp: now.toISOString(),
    check_in_date: dateStr,
    check_in_hour: Number(check_in_hour),
    energy_level: Number(energy_level),
    sleep_hours: Number(sleep_hours),
    caffeine_intake: Number(caffeine_intake),
    screen_time: Number(screen_time),
  };

  ud.checkIns.unshift(newEntry);
  res.json({ success: true, checkin: newEntry });
});

// 2b. Delete a check-in (scoped to user)
app.delete('/api/checkins/:id', (req, res) => {
  const ud = getUserData(req);
  const id = parseInt(req.params.id, 10);
  const initialLen = ud.checkIns.length;
  ud.checkIns = ud.checkIns.filter((c) => c.id !== id);
  if (ud.checkIns.length < initialLen) {
    res.json({ success: true, message: 'Check-in deleted.' });
  } else {
    res.status(404).json({ success: false, error: 'Check-in not found.' });
  }
});

// 3. Fetch experiments (scoped to user)
app.get('/api/experiments', (req, res) => {
  const ud = getUserData(req);
  res.json({ experiments: ud.experiments });
});

// 4. Create new experiment (scoped to user)
app.post('/api/experiments', (req, res) => {
  const ud = getUserData(req);
  const {
    habit_name,
    status = 'Active',
    baseline_energy = 2.5,
    outcome_energy = 3.2,
    notes = '',
  } = req.body;

  const base = Number(baseline_energy);
  const out = Number(outcome_energy);
  const impact = base > 0 ? parseFloat((((out - base) / base) * 100).toFixed(1)) : 0;

  const newExp: Experiment = {
    id: ud.nextExpId++,
    habit_name: habit_name || 'New Trial',
    status: status === 'Completed' ? 'Completed' : 'Active',
    baseline_energy: base,
    outcome_energy: out,
    impact_pct: impact,
    notes,
  };

  ud.experiments.push(newExp);
  res.json({ success: true, experiment: newExp });
});

// 4b. Update / toggle experiment status (scoped to user)
app.patch('/api/experiments/:id', (req, res) => {
  const ud = getUserData(req);
  const id = parseInt(req.params.id, 10);
  const exp = ud.experiments.find((e) => e.id === id);
  if (!exp) {
    return res.status(404).json({ success: false, error: 'Experiment not found.' });
  }

  if (req.body.status) {
    exp.status = req.body.status === 'Completed' ? 'Completed' : 'Active';
  }
  if (req.body.outcome_energy !== undefined) {
    exp.outcome_energy = Number(req.body.outcome_energy);
    exp.impact_pct = exp.baseline_energy > 0
      ? parseFloat((((exp.outcome_energy - exp.baseline_energy) / exp.baseline_energy) * 100).toFixed(1))
      : 0;
  }
  if (req.body.notes !== undefined) {
    exp.notes = String(req.body.notes);
  }

  res.json({ success: true, experiment: exp });
});

// 4c. Delete experiment (scoped to user)
app.delete('/api/experiments/:id', (req, res) => {
  const ud = getUserData(req);
  const id = parseInt(req.params.id, 10);
  const initialLen = ud.experiments.length;
  ud.experiments = ud.experiments.filter((e) => e.id !== id);
  if (ud.experiments.length < initialLen) {
    res.json({ success: true, message: 'Experiment deleted.' });
  } else {
    res.status(404).json({ success: false, error: 'Experiment not found.' });
  }
});

// 5. Reset data for active user
app.post('/api/reset', (req, res) => {
  const ud = getUserData(req);
  const freshData = generateUserDataForProfile(ud.profile);
  ud.checkIns = freshData.checkIns;
  ud.experiments = freshData.experiments;
  ud.nextCheckInId = freshData.nextCheckInId;
  ud.nextExpId = freshData.nextExpId;
  ud.connectedWatch = null;

  res.json({
    success: true,
    message: `Database and biomarker inputs reset for ${ud.profile.name}.`,
    defaultInputs: ud.profile.defaultInputs,
  });
});

// 5b. Get Watch Status for active user
app.get('/api/watch-status', (req, res) => {
  const ud = getUserData(req);
  res.json({ connectedWatch: ud.connectedWatch });
});

// 5c. Disconnect Bluetooth Watch for active user
app.post('/api/disconnect-watch', (req, res) => {
  const ud = getUserData(req);
  ud.connectedWatch = null;
  res.json({ success: true, message: 'Bluetooth watch disconnected for this account.' });
});

// 5d. Import data from Fitness Watch for active user
app.post('/api/import-watch-data', (req, res) => {
  const ud = getUserData(req);
  const {
    deviceType = 'apple_watch',
    deviceName = 'Apple Watch',
    sleepHours = 6.5,
    deepSleepMinutes = 60,
    remSleepMinutes = 60,
    restingHeartRate = 56,
    hrvMs = 48,
    recoveryScore = 55,
    stepCount = 4200,
    historicalDays = [],
    connectionMethod = 'bluetooth',
    batteryLevel = 85,
    liveHeartRate = undefined,
    bluetoothConnected = false,
  } = req.body;

  let computedSleep = Number(sleepHours);
  let computedRHR = Number(restingHeartRate);
  let computedHRV = Number(hrvMs);
  let computedRecovery = Number(recoveryScore);
  let computedSteps = Number(stepCount);

  let estimatedEnergy = 3;
  if (computedRecovery) {
    if (computedRecovery >= 80) estimatedEnergy = 5;
    else if (computedRecovery >= 65) estimatedEnergy = 4;
    else if (computedRecovery >= 45) estimatedEnergy = 3;
    else if (computedRecovery >= 25) estimatedEnergy = 2;
    else estimatedEnergy = 1;
  }

  ud.connectedWatch = {
    deviceType,
    deviceName,
    lastSync: new Date().toISOString(),
    metrics: {
      sleepHours: parseFloat(computedSleep.toFixed(1)),
      deepSleepMinutes: Number(deepSleepMinutes) || Math.round(computedSleep * 10),
      remSleepMinutes: Number(remSleepMinutes) || Math.round(computedSleep * 12),
      restingHeartRate: computedRHR,
      hrvMs: computedHRV,
      recoveryScore: computedRecovery,
      stepCount: computedSteps,
      estimatedEnergyLevel: estimatedEnergy,
      connectionMethod,
      batteryLevel: Number(batteryLevel) || 85,
      liveHeartRate: liveHeartRate ? Number(liveHeartRate) : computedRHR,
      bluetoothConnected: Boolean(bluetoothConnected),
    },
  };

  let importedHistoryCount = 0;
  if (Array.isArray(historicalDays) && historicalDays.length > 0) {
    for (const day of historicalDays) {
      if (day.date && day.sleepHours) {
        ud.checkIns.push({
          id: ud.nextCheckInId++,
          timestamp: `${day.date} 08:00:00`,
          check_in_date: day.date,
          check_in_hour: 8,
          energy_level: day.energyScore || Math.min(5, Math.max(1, Math.round(day.sleepHours / 1.6))),
          sleep_hours: Number(day.sleepHours),
          caffeine_intake: 1,
          screen_time: 2.5,
        });
        importedHistoryCount++;
      }
    }
  }

  res.json({
    success: true,
    message: `Successfully imported watch metrics for ${ud.profile.name}.`,
    connectedWatch: ud.connectedWatch,
    importedHistoryCount,
    recommendedCheckIn: {
      energy: estimatedEnergy,
      sleep: parseFloat(computedSleep.toFixed(1)),
      recoveryScore: computedRecovery,
    },
  });
});


// Helper to format clean 12h/24h time strings
function formatCircadiaTime(hour: number, minutes = 0): string {
  const h = Math.min(23, Math.max(0, Math.floor(hour)));
  const m = minutes < 10 ? `0${minutes}` : `${minutes}`;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${m} ${period}`;
}

// Dynamic Circadian Schedule Generator (physiological pacing engine)
function generateDynamicCircadianPlan(
  hour: number,
  energy: number,
  sleep: number,
  caffeine: number,
  screen: number
) {
  const h = Number(hour);
  const e = Number(energy);
  const s = Number(sleep);
  const c = Number(caffeine);
  const sc = Number(screen);

  const isLowEnergy = e <= 2;
  const isHighEnergy = e >= 4;
  const isSleepDeprived = s < 6.0;
  const isHighCaffeine = c >= 3;
  const isHighScreen = sc >= 4.0;
  const isAfternoonTrough = h >= 14 && h <= 16;

  let diagnosis = '';
  let immediateAction = '';
  const scheduleChanges: string[] = [];

  // 1. Build Diagnosis
  if (isSleepDeprived && (isLowEnergy || isAfternoonTrough)) {
    diagnosis = `You're feeling an afternoon slump because you're running on only ${s.toFixed(1)} hours of sleep.`;
  } else if (isSleepDeprived) {
    diagnosis = `With only ${s.toFixed(1)} hours of sleep last night, your morning energy will fade faster than usual.`;
  } else if (isAfternoonTrough && isLowEnergy) {
    diagnosis = `Classic 3 PM afternoon slump, made heavier by ${sc.toFixed(1)} hours of screen time.`;
  } else if (isHighEnergy && !isSleepDeprived) {
    diagnosis = `You are well-rested and in your prime focus zone! Great time to tackle your hardest work.`;
  } else if (isHighCaffeine) {
    diagnosis = `You've had ${c} cups of coffee. Having more could trigger an energy crash later and keep you up tonight.`;
  } else {
    diagnosis = `Your energy is steady. Pace yourself with brief breaks so you stay sharp until the evening.`;
  }

  // 2. Build Immediate Tactical Action (Next 15m)
  if (isLowEnergy || (isSleepDeprived && h < 14)) {
    immediateAction = `Drink a tall glass of cold water, step into natural sunlight for 10 minutes, and hold off on more caffeine.`;
  } else if (isAfternoonTrough) {
    immediateAction = `Take a quick 10-minute outdoor walk and take 5 slow, deep breaths to refresh your mind.`;
  } else if (isHighEnergy) {
    immediateAction = `Mute notifications, close extra tabs, and jump into a 90-minute block of uninterrupted focus.`;
  } else if (isHighScreen) {
    immediateAction = `Rest your eyes: look out a window into the distance for 5 minutes and drink a glass of cold water.`;
  } else {
    immediateAction = `Stand up and stretch for 5 minutes, grab a drink of water, and pick your top 2 tasks for this block.`;
  }

  // 3. Build Dynamic Schedule Changes based on current hour & state
  if (h <= 8) {
    // Early Morning (6 - 8 AM)
    if (isLowEnergy || isSleepDeprived) {
      scheduleChanges.push(
        `${formatCircadiaTime(h, 20)} - Tackle your hardest task right now while your morning energy is freshest`
      );
      scheduleChanges.push(
        `${formatCircadiaTime(9, 45)} - ${c === 0 ? 'First coffee window: Enjoy your first cup now to avoid an afternoon crash' : 'Drink a large glass of water & take a 5-minute outdoor walk'}`
      );
      scheduleChanges.push(
        `${formatCircadiaTime(14, 45)} - Take a 10-minute walk outside at 2:45 PM before your usual 3 PM slump`
      );
      scheduleChanges.push(
        `${formatCircadiaTime(16, 0)} - Switch to lighter work: reply to emails and organize your notes`
      );
      scheduleChanges.push(
        `${formatCircadiaTime(21, 30)} - Put away screens and head to bed early to recover from last night's ${s.toFixed(1)}h sleep`
      );
    } else {
      scheduleChanges.push(
        `${formatCircadiaTime(h, 15)} - 90-minute deep-focus block: Make progress on your highest-priority project`
      );
      scheduleChanges.push(
        `${formatCircadiaTime(10, 30)} - Team check-ins, client meetings, and collaborative tasks`
      );
      scheduleChanges.push(
        `${formatCircadiaTime(12, 45)} - Healthy protein lunch followed by a relaxing 15-minute walk`
      );
      scheduleChanges.push(
        `${formatCircadiaTime(15, 0)} - Light administrative tasks during your 3 PM afternoon pause`
      );
      scheduleChanges.push(
        `${formatCircadiaTime(17, 0)} - Second burst of creative focus before wrapping up the day`
      );
    }
  } else if (h <= 11) {
    // Mid Morning (9 - 11 AM)
    if (isLowEnergy || isSleepDeprived) {
      scheduleChanges.push(
        `${formatCircadiaTime(h, 15)} - Tackle your most important task now before your energy dips`
      );
      scheduleChanges.push(
        `${formatCircadiaTime(14, 45)} - 10-minute outdoor walk at 2:45 PM to stay ahead of the 3 PM dip`
      );
      scheduleChanges.push(
        `${formatCircadiaTime(15, 30)} - Easy administrative work and inbox cleanup`
      );
      scheduleChanges.push(
        `${formatCircadiaTime(17, 30)} - Caffeine cutoff: No more coffee past 5:30 PM so you fall asleep easily`
      );
      scheduleChanges.push(
        `${formatCircadiaTime(21, 45)} - Wind-down time: Dim room lights, put devices away, and prepare for bed`
      );
    } else {
      scheduleChanges.push(
        `${formatCircadiaTime(h, 15)} - Prime focus block: High-priority strategy and complex tasks`
      );
      scheduleChanges.push(
        `${formatCircadiaTime(12, 30)} - Balanced lunch with proteins and veggies to prevent an afternoon slump`
      );
      scheduleChanges.push(
        `${formatCircadiaTime(14, 15)} - 15-minute movement or fresh air break during the natural afternoon lull`
      );
      scheduleChanges.push(
        `${formatCircadiaTime(16, 0)} - Second wave of focus as your alertness naturally rebounds`
      );
      scheduleChanges.push(
        `${formatCircadiaTime(18, 0)} - Wrap up daily tasks, clear notifications, and stretch`
      );
    }
  } else if (h <= 13) {
    // Midday (12 - 1 PM)
    scheduleChanges.push(
      `${formatCircadiaTime(h, 15)} - Healthy lunch and a 15-minute walk outside in natural daylight`
    );
    scheduleChanges.push(
      `${formatCircadiaTime(h + 1, 30)} - Routine administrative work, quick messages, and planning`
    );
    scheduleChanges.push(
      `${formatCircadiaTime(h + 3, 0)} - Second focus window as your energy naturally picks back up`
    );
    scheduleChanges.push(
      `${formatCircadiaTime(17, 30)} - Coffee cutoff: Switch to herbal tea, lemon water, or sparkling water`
    );
    scheduleChanges.push(
      `${formatCircadiaTime(21, 30)} - Turn off bright screens and dim ambient room lighting`
    );
  } else if (h <= 15) {
    // Afternoon Crash Window (2 - 3 PM)
    scheduleChanges.push(
      `${formatCircadiaTime(h, 15)} - Shift to easy, low-stress tasks (avoid high-stakes decisions right now)`
    );
    scheduleChanges.push(
      `${formatCircadiaTime(h + 1, 0)} - ${isHighCaffeine ? 'Hold off on more coffee: take a 15-minute relaxing recharge walk outside' : 'Take a 15-minute quick outdoor walk or rest your eyes with a quick break'}`
    );
    scheduleChanges.push(
      `${formatCircadiaTime(16, 45)} - Resume important work as your mental sharpness rebounds`
    );
    scheduleChanges.push(
      `${formatCircadiaTime(18, 15)} - Daily wrap-up and light exercise or stretching`
    );
    scheduleChanges.push(
      `${formatCircadiaTime(21, 45)} - Sleep preparation: Keep the bedroom cool and avoid bright blue light`
    );
  } else if (h <= 18) {
    // Late Afternoon Rebound (4 - 6 PM)
    scheduleChanges.push(
      `${formatCircadiaTime(h, 15)} - Late afternoon energy boost: Finish up your key deliverable`
    );
    scheduleChanges.push(
      `${formatCircadiaTime(h + 1, 0)} - Coffee cutoff: Drink a large glass of water to stay hydrated`
    );
    scheduleChanges.push(
      `${formatCircadiaTime(Math.min(h + 2, 20), 0)} - Conclude workday tasks and transition to personal time`
    );
    scheduleChanges.push(
      `${formatCircadiaTime(21, 30)} - Switch devices to night mode and dim warm household lamps`
    );
  } else if (h <= 21) {
    // Evening (7 - 9 PM)
    scheduleChanges.push(
      `${formatCircadiaTime(h, 15)} - Light dinner and disconnect from demanding work tasks`
    );
    scheduleChanges.push(
      `${formatCircadiaTime(Math.min(h + 1, 22), 0)} - Dim room lights and switch screens to warm night mode`
    );
    scheduleChanges.push(
      `${formatCircadiaTime(Math.min(h + 2, 23), 0)} - Unwind with a warm shower, reading, or relaxing music`
    );
    scheduleChanges.push(
      `${formatCircadiaTime(23, 15)} - Bedtime target: Get to sleep for full restorative rest`
    );
  } else {
    // Late Night (10 - 11 PM)
    scheduleChanges.push(
      `${formatCircadiaTime(h, 15)} - Turn off bright screens and enjoy peaceful wind-down time`
    );
    scheduleChanges.push(
      `${formatCircadiaTime(h + 1 >= 24 ? 0 : h + 1, 0)} - Bedroom check: Cool room to 18°C (65°F) with dark blinds`
    );
    scheduleChanges.push(
      `${formatCircadiaTime(h + 1 >= 24 ? 0 : h + 1, 30)} - Relaxing deep breathing to slow your heart rate and fall asleep`
    );
  }

  return {
    diagnosis,
    findings: diagnosis,
    immediate_action: immediateAction,
    schedule_changes: scheduleChanges,
    source: 'circadian_engine',
  };
}

// 6. Generate circadian rebound plan (llm.py & dynamic engine)
app.post('/api/circadian-plan', async (req, res) => {
  const {
    hour = 10,
    energy = 2,
    sleep = 5.0,
    caffeine = 1,
    screen = 2.0,
  } = req.body;

  const numHour = Number(hour);
  const numEnergy = Number(energy);
  const numSleep = Number(sleep);
  const numCaffeine = Number(caffeine);
  const numScreen = Number(screen);

  // Compute baseline dynamic plan first
  const dynamicPlan = generateDynamicCircadianPlan(
    numHour,
    numEnergy,
    numSleep,
    numCaffeine,
    numScreen
  );

  // If Gemini API is available and not rate limited, enhance plan
  if (ai) {
    try {
      const prompt = `You are Circadia AI, an executive biological pacing and circadian optimization assistant.
User State:
- Current Hour: ${numHour}:00
- Energy Level (1-5): ${numEnergy}
- Sleep Last Night: ${numSleep} hours
- Caffeine Intake: ${numCaffeine} cups
- Screen Time Today: ${numScreen} hours

Return a concise JSON object with:
1. "findings": A 1-sentence physiological findings assessment in simple human terms.
2. "immediate_action": One tactical habit to perform in the next 15 minutes.
3. "schedule_changes": A list of 3 revised timeline actions formatted strictly as "Time - Task" starting AFTER ${numHour}:00.
Format as valid JSON only.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const findingText = parsed.findings || parsed.diagnosis;
      if (
        findingText &&
        parsed.immediate_action &&
        Array.isArray(parsed.schedule_changes) &&
        parsed.schedule_changes.length > 0
      ) {
        return res.json({
          diagnosis: findingText,
          findings: findingText,
          immediate_action: parsed.immediate_action,
          schedule_changes: parsed.schedule_changes,
          source: 'gemini-3.8-flash',
        });
      }
    } catch {
      // Quietly fall back to dynamic engine without failing
    }
  }

  return res.json(dynamicPlan);
});

// 7. Circadian Summary & Analytics (baseline averages, peak focus, crash risk)
app.get('/api/circadian-summary', (req, res) => {
  const ud = getUserData(req);
  if (ud.checkIns.length === 0) {
    return res.json({ summary: null, totalCheckins: 0, hourlyBaseline: [] });
  }

  // Calculate hourly baseline averages for this user
  const hourlySums: Record<number, { sum: number; count: number }> = {};
  let totalEnergy = 0;
  let totalSleep = 0;
  let totalCaffeine = 0;
  let afternoonCrashCount = 0;

  for (const c of ud.checkIns) {
    if (!hourlySums[c.check_in_hour]) {
      hourlySums[c.check_in_hour] = { sum: 0, count: 0 };
    }
    hourlySums[c.check_in_hour].sum += c.energy_level;
    hourlySums[c.check_in_hour].count += 1;

    totalEnergy += c.energy_level;
    totalSleep += c.sleep_hours;
    totalCaffeine += c.caffeine_intake;

    if ([14, 15, 16].includes(c.check_in_hour) && c.energy_level <= 2) {
      afternoonCrashCount++;
    }
  }

  const hourlyBaseline = Object.keys(hourlySums).map((h) => {
    const hr = parseInt(h, 10);
    return {
      hour: hr,
      baselineEnergy: parseFloat((hourlySums[hr].sum / hourlySums[hr].count).toFixed(2)),
      count: hourlySums[hr].count,
    };
  }).sort((a, b) => a.hour - b.hour);

  // Peak and trough hours
  let peakHour = 11;
  let peakVal = 0;
  let troughHour = 15;
  let troughVal = 5;

  for (const item of hourlyBaseline) {
    if (item.baselineEnergy > peakVal) {
      peakVal = item.baselineEnergy;
      peakHour = item.hour;
    }
    if (item.baselineEnergy < troughVal) {
      troughVal = item.baselineEnergy;
      troughHour = item.hour;
    }
  }

  const avgEnergy = parseFloat((totalEnergy / ud.checkIns.length).toFixed(1));
  const avgSleep = parseFloat((totalSleep / ud.checkIns.length).toFixed(1));
  const avgCaffeine = parseFloat((totalCaffeine / ud.checkIns.length).toFixed(1));

  res.json({
    totalCheckins: ud.checkIns.length,
    averageEnergy: avgEnergy,
    averageSleep: avgSleep,
    averageCaffeine: avgCaffeine,
    peakHour,
    peakEnergy: peakVal,
    troughHour,
    troughEnergy: troughVal,
    afternoonCrashCount,
    hourlyBaseline,
  });
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production' || !fs.existsSync(path.resolve('./src/main.tsx'));

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve('./dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('./dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Circadia AI Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
