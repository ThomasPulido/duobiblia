import {
  STREAK_GOAL,
  books,
  completePrayer,
  dateKey,
  featuredVerses,
  getDailyVerse,
  hasCompletedPrayer,
  getMoodVerse,
  getLocalDayPeriod,
  getVerse,
  getWordHelp,
  migratePrayerCompletions,
  moodOptions,
  progressPercent,
  prayerDayKey,
  searchFeatured,
  topics
} from "./src/core.mjs";
import { getAnnualDevotional } from "./src/daily-content.mjs";
import { getDailyQuizSet } from "./src/annual-quizzes.mjs";
import { initializeMobileAds, showAchievementInterstitial, showAdPrivacyOptions } from "./src/ads.mjs";
import { App as MobileApp } from "@capacitor/app";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { BIBLE_VERSIONS, getBibleChapter, searchBible } from "./src/bible-service.mjs";
import { chooseNextTrack, prayerTracks } from "./src/music.mjs";
import { translateWithContext } from "./src/translation-service.mjs";
import { alignParallelFragment, selectionWords, translationMode } from "./src/translation-policy.mjs";
import { authConfigured, claimStreakReward, deleteAccount, getAuthCapabilities, getEntitlement, initializeAuth, mergeProgress, sendEmailCode, signInWithGoogle, signOut, syncProgress, verifyEmailCode } from "./src/auth-service.mjs";
import { externalBillingEnabled, openBoldCheckout } from "./src/billing-service.mjs";
import { APP_VERSION, checkRequiredUpdate, openRequiredUpdate } from "./src/update-service.mjs";
import { syncNativePremiumState } from "./src/native-state.mjs";
import { disablePrayerNotifications, enablePrayerNotifications, initializePrayerNotifications, refreshPrayerNotifications } from "./src/notification-service.mjs";
import { findReadingPlanChapter, getCompletedBookProgress, getReadingPlanDay, getReadingPlanWeek, nextIncompletePlanDay, READING_PLAN_DAYS } from "./src/reading-plan.mjs";
import { DEVOTIONAL_DAYS, DEVOTIONAL_SUBTITLE, DEVOTIONAL_TITLE, devotionalIndexForDate, getDailyYouthDevotionalPreview, getYouthDevotionalPreview } from "./src/devotional-calendar.mjs";
import { openAccountDeletionPage, openPrivacyPolicy } from "./src/legal-service.mjs";

const STORAGE_KEY = "duobiblia-state-v1";
const STORAGE_BACKUP_KEY = "duobiblia-state-backup-v1";
const DATA_SCHEMA_VERSION = 6;
const PERSISTED_PROGRESS_FIELDS = [
  "streak", "points", "lastPrayerDate", "lastPrayerCompletedAt", "prayerCompletions",
  "favorites", "notes", "highlights", "verseRecords", "completedPlanDays", "moodDate",
  "quizCompleted", "quizAnswer", "lastQuizDate", "lastQuizAdDate", "dailyQuizDate",
  "dailyQuizAnswers", "dailyQuizCompleted", "quizStats", "completedDevotionalDays", "devotionalDay", "uiLang", "bibleVersion"
];
const initialState = {
  dataSchemaVersion: DATA_SCHEMA_VERSION,
  phase: "splash",
  onboarded: false,
  uiLang: "es",
  bibleVersion: "mi-biblia",
  route: "home",
  selectedVerseId: "john-14-27",
  selectedBookId: "GEN",
  selectedChapter: 1,
  selectedKjvVerse: null,
  kjvChapter: null,
  kjvLoading: false,
  kjvError: null,
  fullSearchResults: null,
  fullSearchLoading: false,
  selectedTopic: "paz",
  dark: false,
  streak: 0,
  points: 0,
  lastPrayerDate: null,
  lastPrayerCompletedAt: null,
  prayerCompletions: {},
  moodDate: null,
  favorites: [],
  notes: {},
  highlights: {},
  verseRecords: {},
  quizCompleted: false,
  quizAnswer: null,
  lastQuizDate: null,
  lastQuizAdDate: null,
  dailyQuizDate: null,
  dailyQuizAnswers: { language: null, bible: null },
  dailyQuizCompleted: { language: false, bible: false },
  quizStats: { answered: 0, correct: 0, wordsLearned: 0 },
  account: null,
  premium: false,
  premiumUntil: null,
  readChapters: 0,
  completedPlanDays: [],
  completedDevotionalDays: [],
  devotionalDay: devotionalIndexForDate(),
  devotionalContent: null,
  devotionalLoading: false,
  devotionalError: null,
  readingPlanWeek: 1,
  activePlanDay: null,
  progressUpdatedAt: null,
  progressRevision: 0,
  fieldUpdatedAt: {},
  audioPlaying: false,
  musicEnabled: true,
  currentTrackId: null,
  authUser: null,
  authLoading: false,
  authError: null,
  authEmail: "",
  googleAuthEnabled: null,
  emailAuthEnabled: true,
  cloudProfilesEnabled: null,
  pendingPremium: false,
  pendingStreakReward: false,
  notificationPromptSeen: false,
  notificationsEnabled: false,
  updateRequired: null,
  modal: null
};

let state = loadState();
let prayerAudio = null;
let progressSyncTimer = null;
let devotionalLoadPromise = null;
let prayerOpenedFromNotification = false;
let activeSelectionKey = null;
const NativeVerseShare = registerPlugin("VerseShare");
const app = document.querySelector("#app");
const toastRegion = document.querySelector("#toast-region");

const text = (es, en) => state.uiLang === "es" ? es : en;
const opposite = () => state.uiLang === "es" ? "en" : "es";

function loadState() {
  try {
    const saved = readLatestSavedState();
    const restored = { ...initialState, ...(saved || {}), phase: "splash", modal: null, audioPlaying: false };
    restored.completedPlanDays = [...new Set((restored.completedPlanDays || [])
      .map(Number)
      .filter((day) => Number.isInteger(day) && day >= 1 && day <= READING_PLAN_DAYS))].sort((a, b) => a - b);
    restored.readChapters = restored.completedPlanDays.length;
    restored.completedDevotionalDays = [...new Set((restored.completedDevotionalDays || []).filter((id) => /^\d{2}-\d{2}$/.test(id)))];
    const restoredDevotionalDay = Number(restored.devotionalDay);
    restored.devotionalDay = Number.isInteger(restoredDevotionalDay)
      ? Math.max(0, Math.min(DEVOTIONAL_DAYS - 1, restoredDevotionalDay))
      : devotionalIndexForDate();
    restored.readingPlanWeek = Math.max(1, Math.min(53, Number(restored.readingPlanWeek) || 1));
    restored.prayerCompletions = { ...(restored.prayerCompletions || {}) };
    restored.dailyQuizAnswers = { language: null, bible: null, ...(restored.dailyQuizAnswers || {}) };
    restored.dailyQuizCompleted = { language: false, bible: false, ...(restored.dailyQuizCompleted || {}) };
    restored.quizStats = { answered: 0, correct: 0, wordsLearned: 0, ...(restored.quizStats || {}) };
    const savedSchema = Number(saved?.dataSchemaVersion) || 0;
    if (savedSchema < 3) {
      restored.completedPlanDays = [];
      restored.readChapters = 0;
      restored.readingPlanWeek = 1;
      restored.activePlanDay = null;
      // Version 2 stored only one cloud-synced date. It could falsely block a
      // new morning/night ritual, so it is deliberately not promoted.
      restored.prayerCompletions = {};
      restored.lastPrayerDate = null;
      restored.lastPrayerCompletedAt = null;
      restored.dailyQuizDate = dateKey();
      restored.dailyQuizAnswers = { language: null, bible: null };
      restored.dailyQuizCompleted = { language: false, bible: false };
      restored.progressUpdatedAt = new Date().toISOString();
      restored.progressRevision = (Number(restored.progressRevision) || 0) + 1;
    }
    if (savedSchema < 4) {
      restored.prayerCompletions = migratePrayerCompletions(restored.prayerCompletions);
      const latestCompletion = Object.values(restored.prayerCompletions)
        .map((value) => new Date(value))
        .filter((value) => !Number.isNaN(value.getTime()))
        .sort((left, right) => right - left)[0];
      if (latestCompletion) restored.lastPrayerDate = prayerDayKey(latestCompletion);
      restored.progressUpdatedAt = new Date().toISOString();
      restored.progressRevision = (Number(restored.progressRevision) || 0) + 1;
    }
    restored.fieldUpdatedAt = { ...(restored.fieldUpdatedAt || {}) };
    if (saved && savedSchema < DATA_SCHEMA_VERSION) {
      const migratedAt = restored.progressUpdatedAt || new Date().toISOString();
      for (const field of PERSISTED_PROGRESS_FIELDS) {
        if (!(field in restored.fieldUpdatedAt)) restored.fieldUpdatedAt[field] = migratedAt;
      }
      restored.progressUpdatedAt = migratedAt;
      restored.progressRevision = (Number(restored.progressRevision) || 0) + 1;
    }
    restored.dataSchemaVersion = DATA_SCHEMA_VERSION;
    if (!restored.premiumUntil || new Date(restored.premiumUntil) <= new Date()) restored.premium = false;
    if (restored.dailyQuizDate !== dateKey()) {
      restored.dailyQuizDate = dateKey();
      restored.dailyQuizAnswers = { language: null, bible: null };
      restored.dailyQuizCompleted = { language: false, bible: false };
      restored.quizCompleted = false;
      restored.quizAnswer = null;
    }
    return restored;
  } catch {
    return { ...initialState };
  }
}

function readStoredState(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function readLatestSavedState() {
  const candidates = [readStoredState(STORAGE_KEY), readStoredState(STORAGE_BACKUP_KEY)].filter(Boolean);
  return candidates.sort((left, right) => {
    const revisionDifference = (Number(right.progressRevision) || 0) - (Number(left.progressRevision) || 0);
    if (revisionDifference) return revisionDifference;
    return (Date.parse(right.progressUpdatedAt || "") || 0) - (Date.parse(left.progressUpdatedAt || "") || 0);
  })[0] || null;
}

function persist() {
  const { phase, modal, audioPlaying, kjvChapter, kjvLoading, kjvError, fullSearchResults, fullSearchLoading, devotionalContent, devotionalLoading, devotionalError, authUser, authLoading, authError, pendingPremium, updateRequired, ...persistable } = state;
  const payload = JSON.stringify(persistable);
  localStorage.setItem(STORAGE_KEY, payload);
  localStorage.setItem(STORAGE_BACKUP_KEY, payload);
}

function progressStateSignature(value) {
  return JSON.stringify({
    streak: value.streak,
    points: value.points,
    lastPrayerDate: value.lastPrayerDate,
    lastPrayerCompletedAt: value.lastPrayerCompletedAt,
    prayerCompletions: value.prayerCompletions,
    favorites: value.favorites,
    notes: value.notes,
    highlights: value.highlights,
    verseRecords: value.verseRecords,
    completedPlanDays: value.completedPlanDays,
    completedDevotionalDays: value.completedDevotionalDays,
    devotionalDay: value.devotionalDay,
    moodDate: value.moodDate,
    quizCompleted: value.quizCompleted,
    quizAnswer: value.quizAnswer,
    lastQuizDate: value.lastQuizDate,
    lastQuizAdDate: value.lastQuizAdDate,
    dailyQuizDate: value.dailyQuizDate,
    dailyQuizAnswers: value.dailyQuizAnswers,
    dailyQuizCompleted: value.dailyQuizCompleted,
    quizStats: value.quizStats,
    uiLang: value.uiLang,
    bibleVersion: value.bibleVersion
  });
}

function changedProgressFields(previous, next) {
  return PERSISTED_PROGRESS_FIELDS.filter((field) => JSON.stringify(previous[field]) !== JSON.stringify(next[field]));
}

function scheduleProgressSync(delay = 250) {
  if (!state.authUser) return;
  clearTimeout(progressSyncTimer);
  progressSyncTimer = setTimeout(() => {
    progressSyncTimer = null;
    syncProgress(state.authUser, progressForSync()).catch(() => {});
  }, delay);
}

function flushProgressSync() {
  clearTimeout(progressSyncTimer);
  progressSyncTimer = null;
  if (!state.authUser) return Promise.resolve(null);
  return syncProgress(state.authUser, progressForSync()).catch(() => null);
}

function setState(update, shouldPersist = true, shouldRender = true) {
  const previousPremium = state.premium;
  const previousSignature = progressStateSignature(state);
  const patch = typeof update === "function" ? update(state) : update;
  let nextState = { ...state, ...patch };
  const progressChanged = previousSignature !== progressStateSignature(nextState);
  const localProgressMutation = shouldPersist && progressChanged && !("progressUpdatedAt" in patch);
  if (localProgressMutation) {
    const mutationTime = new Date().toISOString();
    const fieldUpdatedAt = { ...(state.fieldUpdatedAt || {}) };
    for (const field of changedProgressFields(state, nextState)) fieldUpdatedAt[field] = mutationTime;
    nextState = {
      ...nextState,
      progressUpdatedAt: mutationTime,
      progressRevision: (Number(state.progressRevision) || 0) + 1,
      fieldUpdatedAt
    };
  }
  state = nextState;
  if (shouldPersist) {
    persist();
    if (localProgressMutation) scheduleProgressSync();
  }
  if (state.premium !== previousPremium) syncNativePremiumState(state.premium).catch(() => {});
  if (shouldRender) render();
}

persist();

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  })[character]);
}

function dualText(es, en, className = "") {
  const primary = state.uiLang === "es" ? es : en;
  const secondary = state.uiLang === "es" ? en : es;
  const secondaryLang = state.uiLang === "es" ? "en" : "es";
  return `<span class="dual-copy ${className}"><span>${escapeHtml(primary)}</span><small lang="${secondaryLang}">${escapeHtml(secondary)}</small></span>`;
}

function dualObject(copy, className = "") {
  return dualText(copy.es, copy.en, className);
}

function icon(name, label = "") {
  const paths = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9 20v-6h6v6"/>',
    bible: '<path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5v-17Z"/><path d="M5 4.5v17M12.5 6v7M9 9.5h7"/>',
    learn: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14h2M14 14h2"/>',
    profile: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    flame: '<path d="M12 22c4 0 7-3 7-7 0-5-4-7-4-11-3 2-5 5-4 8-1-1-2-3-2-4-3 2-4 5-4 7 0 4 3 7 7 7Z"/>',
    star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
    heart: '<path d="M20.8 5.7c-1.8-2.1-5-2.3-7-.4L12 7l-1.8-1.7c-2-1.9-5.2-1.7-7 .4-1.7 2-1.5 5 .4 6.9L12 21l8.4-8.4c1.9-1.9 2.1-4.9.4-6.9Z"/>',
    note: '<path d="M4 4h16v16H4zM8 9h8M8 13h6M8 17h4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    moon: '<path d="M21 12.7A9 9 0 1 1 11.3 3 7 7 0 0 0 21 12.7Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    sunrise: '<path d="M4 18h16M6 22h12M8 18a4 4 0 0 1 8 0M12 4v4M4.9 8.9l2.8 2.8M19.1 8.9l-2.8 2.8M2 14h4M18 14h4"/>',
    moonStars: '<path d="M19.7 15.1A8 8 0 1 1 9 4.3a6.4 6.4 0 0 0 10.7 10.8Z"/><path d="m18 3 .5 1.4L20 5l-1.5.6L18 7l-.5-1.4L16 5l1.5-.6L18 3ZM21 9l.3.8.7.2-.7.3-.3.7-.3-.7-.7-.3.7-.2L21 9Z"/>',
    play: '<path d="m8 5 11 7-11 7V5Z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    crown: '<path d="m3 7 4 5 5-8 5 8 4-5-2 12H5L3 7Z"/>',
    shield: '<path d="M12 3 5 6v5c0 4.7 2.8 8 7 10 4.2-2 7-5.3 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    volume: '<path d="M11 5 6 9H2v6h4l5 4V5ZM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
    skip: '<path d="m5 5 10 7L5 19V5ZM19 5v14"/>',
    translate: '<path d="M4 5h10M9 3v2M7 5c0 4 2 7 7 9M12 5c-1 4-4 7-8 9M14 20l3-8 3 8M15 17h4"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.5-4.5M8.2 13.2l7.5 4.5"/>',
    palette: '<path d="M12 3a9 9 0 0 0 0 18h1.4a2.1 2.1 0 0 0 1.2-3.8 1.8 1.8 0 0 1 1-3.3H18A3 3 0 0 0 21 11a8 8 0 0 0-9-8Z"/><circle cx="7.5" cy="10" r=".8" fill="currentColor"/><circle cx="10" cy="6.8" r=".8" fill="currentColor"/><circle cx="14.2" cy="6.8" r=".8" fill="currentColor"/><circle cx="16.8" cy="10" r=".8" fill="currentColor"/>',
    more: '<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>'
  };
  return `<svg class="icon icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.star}</svg>${label ? `<span class="sr-only">${label}</span>` : ""}`;
}

function spotIllustration(name, extraClass = "") {
  return `<span class="spot-illustration spot-${name} ${extraClass}" aria-hidden="true"></span>`;
}

function featuredVerseRecord(verse, sourceLang = state.uiLang) {
  const language = sourceLang === "es" ? "es" : "en";
  return {
    key: verse.id,
    featuredId: verse.id,
    text: verse[language],
    reference: verse.reference[language],
    sourceLang: language,
    version: language === "en" ? "kjv" : "mi-biblia",
    bookId: verse.book.id,
    chapter: verse.chapter,
    verse: verse.verse
  };
}

function chapterVerseRecord(value, verseNumber, version, book, chapter) {
  return {
    key: `bible:${version.id}:${book.id}:${chapter}:${verseNumber}`,
    text: value,
    reference: `${book[version.language]} ${chapter}:${verseNumber}`,
    sourceLang: version.language,
    version: version.id,
    bookId: book.id,
    chapter,
    verse: verseNumber
  };
}

function verseHostAttributes(record) {
  return `data-verse-key="${escapeHtml(record.key)}" data-featured-id="${escapeHtml(record.featuredId || "")}" data-verse-text="${escapeHtml(record.text)}" data-verse-reference="${escapeHtml(record.reference)}" data-source-lang="${record.sourceLang}" data-version="${record.version}" data-book-id="${record.bookId || ""}" data-chapter="${record.chapter || ""}" data-verse-number="${record.verse || ""}" data-verse-context="${escapeHtml(record.text)}"`;
}

function recordFromElement(element) {
  const host = element?.closest?.("[data-verse-key]");
  const featuredId = host?.dataset.featuredId || element?.dataset?.verse || "";
  if (featuredId) {
    const sourceLang = host?.dataset.sourceLang || state.uiLang;
    return featuredVerseRecord(getVerse(featuredId), sourceLang);
  }
  if (!host) return null;
  return {
    key: host.dataset.verseKey,
    text: host.dataset.verseText,
    reference: host.dataset.verseReference,
    sourceLang: host.dataset.sourceLang,
    version: host.dataset.version,
    bookId: host.dataset.bookId,
    chapter: Number(host.dataset.chapter),
    verse: Number(host.dataset.verseNumber)
  };
}

function resolveVerseRecord(key) {
  const normalizedKey = String(key || "").replace(/^featured:/, "");
  const stored = state.verseRecords[key] || state.verseRecords[normalizedKey] || null;
  const featured = featuredVerses.find((verse) => verse.id === normalizedKey);
  if (featured) return featuredVerseRecord(featured, stored?.sourceLang || state.uiLang);
  const match = normalizedKey.match(/^bible:(kjv|mi-biblia):([^:]+):(\d+):(\d+)$/);
  if (!match) return stored;
  const [, versionId, bookId, chapter, verse] = match;
  const version = BIBLE_VERSIONS[versionId];
  const book = books.find((item) => item.id === bookId);
  if (!version || !book) return stored;
  return {
    key: normalizedKey,
    text: stored?.text || text("Toca para volver a abrir este versículo.", "Tap to reopen this verse."),
    reference: stored?.reference || `${book[version.language]} ${chapter}:${verse}`,
    sourceLang: stored?.sourceLang || version.language,
    version: versionId,
    bookId,
    chapter: Number(chapter),
    verse: Number(verse),
    ...stored
  };
}

async function ensurePrayerNotificationSchedule() {
  if (!Capacitor.isNativePlatform() || !state.notificationsEnabled) return false;
  try {
    const enabled = await refreshPrayerNotifications(state.uiLang);
    if (!enabled && state.notificationsEnabled) setState({ notificationsEnabled: false, notificationPromptSeen: true });
    return enabled;
  } catch {
    return false;
  }
}

function withStoredRecord(record, patch = {}) {
  if (!record) return patch;
  return { ...patch, verseRecords: { ...state.verseRecords, [record.key]: record } };
}

function highlightClass(key) {
  const color = state.highlights[key];
  return color ? `verse-highlight highlight-${color}` : "";
}

function renderSelectionBar() {
  return `<div class="selection-toolbar" aria-live="polite"><span class="selection-preview"></span><button data-action="translate-selection">${icon("translate")}<b>${text("Traducir", "Translate")}</b></button><button class="selection-clear" data-action="clear-selection" aria-label="${text("Limpiar selección", "Clear selection")}">${icon("close")}</button></div>`;
}

function selectionHostAttributes(key, value, sourceLang = state.uiLang, parallelText = "", parallelReference = "") {
  return `data-verse-key="${escapeHtml(key)}" data-verse-text="${escapeHtml(value)}" data-source-lang="${sourceLang}" data-verse-context="${escapeHtml(value)}" data-parallel-text="${escapeHtml(parallelText)}" data-parallel-reference="${escapeHtml(parallelReference)}"`;
}

function renderVerseTools(record, compact = false) {
  if (compact) {
    return `<button class="verse-more-button" data-action="open-verse-tools" aria-label="${text("Opciones del versículo", "Verse options")}">${icon("more")}</button>`;
  }
  const favorite = state.favorites.includes(record.key);
  const noted = Boolean(state.notes[record.key]);
  const highlighted = Boolean(state.highlights[record.key]);
  return `<div class="verse-action-row">
    <button class="${favorite ? "active" : ""}" data-action="toggle-favorite" aria-label="${text("Favorito", "Favorite")}">${icon("heart")}</button>
    <button class="${noted ? "active" : ""}" data-action="open-note" aria-label="${text("Añadir nota", "Add note")}">${icon("note")}</button>
    <button class="${highlighted ? "active" : ""}" data-action="open-highlight" aria-label="${text("Cambiar color", "Change color")}">${icon("palette")}</button>
    <button data-action="share-verse" aria-label="${text("Compartir versículo", "Share verse")}">${icon("share")}</button>
    <button data-action="translate-verse" aria-label="${text("Traducir versículo", "Translate verse")}">${icon("translate")}</button>
  </div>`;
}

function render() {
  document.documentElement.lang = state.uiLang;
  document.body.classList.toggle("dark", state.dark);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", state.dark ? "#102c29" : "#f8f3e8");

  if (state.updateRequired) {
    app.innerHTML = renderUpdateGate();
    return;
  }

  if (state.phase === "splash") {
    app.innerHTML = renderSplash();
    return;
  }
  if (state.phase === "onboarding") {
    app.innerHTML = renderOnboarding();
    return;
  }
  if (state.phase === "mood") {
    app.innerHTML = renderMoodCheck();
    return;
  }
  app.innerHTML = renderShell();
}

function renderUpdateGate() {
  const update = state.updateRequired;
  return `<main class="update-gate"><img src="./assets/app-logo.png" alt="DuoBiblia"/><p class="eyebrow">DUOBIBLIA ${APP_VERSION}</p><h1>${escapeHtml(update.title?.[state.uiLang] || text("Actualización necesaria", "Update required"))}</h1><p>${escapeHtml(update.message?.[state.uiLang] || text("Instala la versión más reciente para continuar.", "Install the latest version to continue."))}</p><button class="primary-button" data-action="open-update">${text("Actualizar ahora", "Update now")}</button><small>${text("Esta actualización es obligatoria para proteger tus datos y mantener la aplicación compatible.", "This update is required to protect your data and keep the app compatible.")}</small></main>`;
}

function renderSplash() {
  return `
    <main class="splash-screen">
      <div class="splash-glow glow-one"></div><div class="splash-glow glow-two"></div>
      <div class="prayer-orbit" aria-hidden="true">
        <span class="orbit-dot dot-one"></span><span class="orbit-dot dot-two"></span><span class="orbit-dot dot-three"></span>
        <div class="prayer-hands">🙏</div>
      </div>
      <img class="splash-logo" src="./assets/app-logo.png" alt="" />
      <h1>DuoBiblia</h1>
      <p>${text("Fe que inspira. Palabras que enseñan.", "Faith that inspires. Words that teach.")}</p>
      <div class="splash-loader"><span></span></div>
    </main>`;
}

function renderOnboarding() {
  return `
    <main class="onboarding-screen">
      <div class="onboarding-art">
        <span class="tiny-label">DUOBIBLIA</span>
        <div class="book-illustration"><span>hello</span><i>♥</i><span>hola</span></div>
      </div>
      <section class="onboarding-copy">
        <p class="eyebrow">Welcome · Bienvenido</p>
        <h1>Choose your path.<br /><em>Elige tu camino.</em></h1>
        <p>Podrás cambiarlo después. Cada palabra será una oportunidad para aprender.<br/><small>You can change it later. Every word will be a chance to learn.</small></p>
      </section>
      <div class="language-options">
        <button class="language-card preferred" data-action="choose-language" data-language="en">
          <span class="language-flag">EN</span>
          <span class="language-copy"><strong>English</strong><small>Preferido para aprender inglés</small></span>
          <span class="preferred-pill">Recomendado · Recommended</span>
        </button>
        <button class="language-card" data-action="choose-language" data-language="es">
          <span class="language-flag spanish">ES</span>
          <span class="language-copy"><strong>Español</strong><small>Preferred to learn Spanish</small></span>
          ${icon("chevron")}
        </button>
      </div>
      <p class="privacy-note">Tu progreso comienza en este dispositivo. · Your progress starts on this device.</p>
    </main>`;
}

function renderMoodCheck() {
  return `
    <main class="mood-screen">
      <header class="simple-header">
        <img src="./assets/app-logo.png" alt="DuoBiblia" />
        <button class="text-button" data-action="skip-mood">${dualText("Omitir", "Skip")}</button>
      </header>
      <div class="mood-heading">
        <span class="eyebrow">${dualText("UN MOMENTO PARA TI", "A MOMENT FOR YOU")}</span>
        <h1>${dualText("¿Cómo te sientes hoy?", "How are you feeling today?")}</h1>
        <p>${dualText("Elige una emoción y encontraremos una palabra para acompañarte.", "Choose an emotion and we'll find a word to walk with you.")}</p>
      </div>
      <div class="mood-grid">
        ${moodOptions.map((mood) => `
          <button class="mood-option" data-action="choose-mood" data-mood="${mood.id}">
            <span>${mood.emoji}</span><strong>${dualObject(mood.label)}</strong>
          </button>`).join("")}
      </div>
      <div class="mood-footer"><span>✦</span><p>${dualText("Tu respuesta es privada y nos ayuda a personalizar tu experiencia.", "Your answer is private and helps personalize your experience.")}</p></div>
      ${renderModal()}
    </main>`;
}

function renderShell() {
  const deepRoute = ["prayer", "reader", "chapter", "topics", "reading-plan", "devotional"].includes(state.route);
  return `
    <div class="app-shell">
      ${deepRoute ? renderDeepHeader() : renderTopBar()}
      <main class="screen-content route-${state.route}">${renderRoute()}</main>
      ${deepRoute ? "" : renderBottomNav()}
      ${renderModal()}
    </div>`;
}

function renderTopBar() {
  if (state.route === "home") {
    return `
      <header class="top-bar top-bar-home" aria-label="${text("Estado diario", "Daily status")}">
        <div class="top-stats home-status-glass">
          <button data-action="switch-language" class="stat-chip language-chip" aria-label="${text("Cambiar a inglés", "Switch to Spanish")}">${icon("translate")}<span>${opposite().toUpperCase()}</span></button>
          <button data-action="open-premium" class="stat-chip premium-chip">${icon("crown")}<span>PLUS</span></button>
          <span class="stat-chip points-chip">${icon("star")}<b>${state.points}</b></span>
          <span class="stat-chip streak-chip">${icon("flame")}<b>${state.streak}</b></span>
        </div>
      </header>`;
  }
  return `
    <header class="top-bar top-bar-${state.route}">
      <button class="brand-button" data-action="nav" data-route="home" aria-label="DuoBiblia inicio">
        <img src="./assets/app-logo.png" alt="" /><span>DuoBiblia</span>
      </button>
      <div class="top-stats">
        <button data-action="switch-language" class="stat-chip language-chip" aria-label="${text("Cambiar a inglés", "Switch to Spanish")}">${icon("translate")}<span>${opposite().toUpperCase()}</span></button>
        <button data-action="open-premium" class="stat-chip premium-chip">${icon("crown")}<span>PLUS</span></button>
        <span class="stat-chip points-chip">${icon("star")}<b>${state.points}</b></span>
        <span class="stat-chip streak-chip">${icon("flame")}<b>${state.streak}</b></span>
      </div>
    </header>`;
}

function renderDeepHeader() {
  const prayer = getPrayerExperience();
  const book = books.find((item) => item.id === state.selectedBookId) || books[0];
  const selectedVerse = getVerse(state.selectedVerseId);
  const titles = {
    prayer: dualObject(prayer.title),
    reader: dualText(selectedVerse.reference.es, selectedVerse.reference.en),
    chapter: dualText(`${book.es} ${state.selectedChapter}`, `${book.en} ${state.selectedChapter}`),
    topics: dualText("Palabras para hoy", "Words for today"),
    "reading-plan": dualText("Plan de lectura", "Reading plan"),
    devotional: dualText("Matutina", "Morning devotional")
  };
  return `
    <header class="deep-header">
      <button class="icon-button" data-action="back">${icon("back", text("Volver", "Back"))}</button>
      <strong>${titles[state.route]}</strong>
      <div class="deep-header-actions"><button class="icon-button" data-action="switch-language">${icon("translate", text("Cambiar idioma", "Switch language"))}</button><button class="icon-button" data-action="toggle-theme">${icon(state.dark ? "sun" : "moon", text("Cambiar tema", "Change theme"))}</button></div>
    </header>`;
}

function getPrayerExperience(date = new Date()) {
  return getAnnualDevotional(date);
  const period = getLocalDayPeriod(date);
  const experiences = {
    morning: {
      period, iconName: "sunrise", verseId: "john-14-27",
      title: { es: "Oración de la mañana", en: "Morning prayer" },
      intro: { es: "Respira. Dios está aquí.", en: "Breathe. God is here." },
      duration: { es: "7 minutos para comenzar en paz", en: "7 minutes to begin in peace" },
      meditationTitle: { es: "Una paz que no depende del ruido", en: "A peace beyond the noise" },
      meditation: { es: "Jesús no promete una vida sin dificultades. Promete una presencia que sostiene el corazón en medio de ellas. Antes de responder a cada preocupación, haz una pausa. Respira y recuerda: no estás caminando solo.", en: "Jesus does not promise a life without difficulty. He promises a presence that holds the heart steady through it. Before answering every worry, pause. Breathe and remember: you are not walking alone." },
      prayerTitle: { es: "Oración para comenzar", en: "A prayer to begin" },
      prayer: { es: "Padre celestial, gracias por regalarme este nuevo día. Cuando mi mente corra hacia la preocupación, recuérdame tu cercanía. Llena mi corazón de la paz que Jesús prometió y guía mis palabras, mis decisiones y mis pasos. En el nombre de Jesús, amén.", en: "Heavenly Father, thank you for the gift of this new day. When my mind runs toward worry, remind me that you are near. Fill my heart with the peace Jesus promised and guide my words, choices, and steps. In Jesus' name, amen." }
    },
    afternoon: {
      period, iconName: "sun", verseId: "psalm-23-4",
      title: { es: "Pausa de oración", en: "Afternoon prayer pause" },
      intro: { es: "Haz una pausa. Él camina contigo.", en: "Pause. He walks with you." },
      duration: { es: "7 minutos para renovar tus fuerzas", en: "7 minutes to renew your strength" },
      meditationTitle: { es: "Compañía en medio del camino", en: "Company along the way" },
      meditation: { es: "La tarde puede traer cansancio y decisiones pendientes. Este salmo no niega los valles: recuerda que la presencia de Dios cambia la manera de atravesarlos.", en: "Afternoon can bring weariness and unfinished decisions. This psalm does not deny the valleys; it reminds us that God's presence changes how we walk through them." },
      prayerTitle: { es: "Oración para continuar", en: "A prayer to continue" },
      prayer: { es: "Señor, renueva mis fuerzas para lo que queda de este día. Dame sabiduría, paciencia y un corazón atento. Acompáñame en cada tarea y ayúdame a llevar paz a quienes encuentre. Amén.", en: "Lord, renew my strength for the rest of this day. Give me wisdom, patience, and an attentive heart. Walk with me through each task and help me bring peace to those I meet. Amen." }
    },
    night: {
      period, iconName: "moonStars", verseId: "psalm-34-18",
      title: { es: "Oración de la noche", en: "Night prayer" },
      intro: { es: "Descansa. Dios permanece cerca.", en: "Rest. God remains near." },
      duration: { es: "7 minutos para cerrar el día en paz", en: "7 minutes to close the day in peace" },
      meditationTitle: { es: "Entregar lo que pesa", en: "Releasing what weighs on you" },
      meditation: { es: "No tienes que llevar a la noche todo lo que ocurrió hoy. Dios se acerca al corazón cansado y recibe tanto la gratitud como el dolor que todavía no sabes explicar.", en: "You do not have to carry everything from today into the night. God draws near to the weary heart and receives both gratitude and pain you still cannot explain." },
      prayerTitle: { es: "Oración para descansar", en: "A prayer for rest" },
      prayer: { es: "Padre, pongo este día en tus manos. Gracias por sostenerme. Perdona mis faltas, calma mis pensamientos y cuida a quienes amo. Concédeme un descanso sereno y esperanza para mañana. En el nombre de Jesús, amén.", en: "Father, I place this day in your hands. Thank you for sustaining me. Forgive my failures, quiet my thoughts, and watch over those I love. Grant me peaceful rest and hope for tomorrow. In Jesus' name, amen." }
    }
  };
  const dailyVerse = getDailyVerse(date);
  const presentation = getReaderPresentation(dailyVerse.id);
  return {
    ...experiences[period],
    verseId: dailyVerse.id,
    meditationTitle: presentation.title,
    meditation: presentation.description
  };
}

function renderBottomNav() {
  const navItems = [
    ["home", "Inicio", "Home"], ["bible", "Biblia", "Bible"], ["learn", "Plan", "Plan"], ["profile", "Más", "More"]
  ];
  return `<nav class="bottom-nav" aria-label="${text("Navegación principal", "Main navigation")}">
    ${navItems.map(([route, es, en]) => `<button data-action="nav" data-route="${route}" class="${state.route === route ? "active" : ""}">${icon(route)}${dualText(es, en, "nav-copy")}</button>`).join("")}
  </nav>`;
}

function renderRoute() {
  const routes = {
    home: renderHome,
    bible: renderBible,
    learn: renderLearn,
    profile: renderProfile,
    prayer: renderPrayer,
    reader: renderReader,
    chapter: renderKjvChapter,
    topics: renderTopics,
    "reading-plan": renderReadingPlan,
    devotional: renderYouthDevotional
  };
  return (routes[state.route] || renderHome)();
}

function renderHome() {
  const verse = getDailyVerse();
  const verseRecord = featuredVerseRecord(verse, state.uiLang);
  const prayer = getPrayerExperience();
  const prayerDone = hasCompletedPrayer(state, new Date(), prayer.period);
  const youthDevotional = getDailyYouthDevotionalPreview();
  const youthDevotionalDone = state.completedDevotionalDays.includes(youthDevotional.id);
  return `
    <section class="reference-home-hero ${highlightClass(verseRecord.key)}" ${verseHostAttributes(verseRecord)}>
      <div class="hero-backdrop" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="hero-streak">${icon("flame")}<strong>${state.streak}</strong>${dualText("días de racha", "day streak", "hero-streak-copy")}</div>
      <span class="hero-kicker">${dualText("VERSÍCULO DEL DÍA", "VERSE OF THE DAY")}</span>
      <article class="hero-verse-button">
        <blockquote>“${renderInteractiveText(verse[state.uiLang])}”</blockquote>
        <button class="hero-reference-button" data-action="open-reader" data-verse="${verse.id}">${verse.reference[state.uiLang]} ›</button>
      </article>
      ${renderSelectionBar()}
      ${renderVerseTools(verseRecord)}
    </section>

    <div class="reference-home-body">

    <section class="section-block">
      <div class="section-title"><div><span class="eyebrow">${dualText("RITUAL DIARIO", "DAILY RITUAL")}</span><h2>${dualObject(prayer.title)}</h2></div><span class="completion-mark ${prayerDone ? "done" : ""}">${prayerDone ? icon("check") : "1"}</span></div>
      <button class="morning-card" data-action="open-prayer">
        <span class="ritual-period-icon ritual-${prayer.period}">${icon(prayer.iconName)}</span>
        <div><strong>${prayerDone ? dualText("Oración completada", "Prayer completed") : dualObject(prayer.duration)}</strong>${dualText("Versículo · Meditación · Oración", "Verse · Meditation · Prayer", "card-secondary")}</div>
        <span class="round-arrow">${icon("play")}</span>
      </button>
    </section>

    <section class="section-block matutina-preview">
      <div class="section-title"><div><span class="eyebrow">${dualText("MATUTINA PARA ADOLESCENTES", "MORNING DEVOTIONAL FOR TEENS")}</span><h2>${escapeHtml(DEVOTIONAL_TITLE)}</h2></div><span class="completion-mark ${youthDevotionalDone ? "done" : ""}">${youthDevotionalDone ? icon("check") : youthDevotional.day}</span></div>
      <button class="matutina-card" data-action="open-devotional">
        <span class="matutina-monogram">V</span>
        <div><small>${escapeHtml(`${youthDevotional.day} de ${youthDevotional.monthName}`)}</small><strong>${escapeHtml(youthDevotional.title)}</strong><p>“${escapeHtml(youthDevotional.verseQuote)}”</p></div>
        <span class="matutina-progress"><b>${state.completedDevotionalDays.length}</b><small>/365</small></span>
      </button>
    </section>

    <section class="section-block">
      <div class="section-title"><div><span class="eyebrow">${dualText("APRENDE Y CRECE", "LEARN & GROW")}</span><h2>${dualText("Reto del día", "Daily challenge")}</h2></div><button class="small-link" data-action="nav" data-route="learn">${dualText("Ver reto", "View challenge")}</button></div>
      <button class="challenge-card" data-action="nav" data-route="learn">
        <div class="challenge-badge">+20 XP</div>
        ${spotIllustration("quiz", "challenge-icon")}
        <div><strong>${dualText("Dos retos nuevos para hoy", "Two new challenges for today")}</strong>${dualText("Idioma + Biblia · 2 preguntas", "Language + Bible · 2 questions", "card-secondary")}</div>
        ${icon("chevron")}
      </button>
    </section>

    <section class="section-block topic-preview">
      <div class="section-title"><div><span class="eyebrow">${dualText("INSPIRACIÓN", "INSPIRATION")}</span><h2>${dualText("Palabras de Dios para hoy", "God's words for today")}</h2></div><button class="small-link" data-action="open-topics">${dualText("Ver todo", "See all")}</button></div>
      <div class="topic-row">${topics.slice(0, 5).map(renderTopicChip).join("")}</div>
    </section>

    <section class="streak-card">
      <div class="streak-visual">${spotIllustration("streak")}<strong>${state.streak}</strong><small>${text("días", "days")}</small></div>
      <div class="streak-copy"><span class="eyebrow">${text("CAMINO A PREMIUM", "PATH TO PREMIUM")}</span><h3>${state.streak >= STREAK_GOAL ? text("Tu regalo está listo", "Your gift is ready") : text(`${STREAK_GOAL - state.streak} días para tu regalo`, `${STREAK_GOAL - state.streak} days to your gift`)}</h3><div class="progress-track"><span style="width:${progressPercent(state.streak)}%"></span></div><small>${text("90 días constantes = 1 mes Premium gratis", "90 consistent days = 1 free Premium month")}</small></div>
    </section>
    </div>`;
}

function renderTopicChip(topic) {
  const illustration = ({ amor: "favorite", paz: "prayer", fe: "bible", perdon: "note", bendiciones: "streak", salvacion: "premium" })[topic.id] || "bible";
  return `<button class="topic-chip ${topic.color}" data-action="select-topic" data-topic="${topic.id}">${spotIllustration(illustration)}<strong>${dualObject(topic.label)}</strong></button>`;
}

function renderBible() {
  const featuredResults = searchFeatured(state.searchQuery || "", state.uiLang);
  const results = state.fullSearchResults ?? featuredResults;
  const version = BIBLE_VERSIONS[state.bibleVersion] || BIBLE_VERSIONS.kjv;
  return `
    <section class="page-heading">
      <div><span class="eyebrow">${dualText("LEE · ESCUCHA · APRENDE", "READ · LISTEN · LEARN")}</span><h1>${dualText("Biblia", "Bible")}</h1></div>
      <button class="icon-button bordered" data-action="toggle-theme">${icon(state.dark ? "sun" : "moon")}</button>
    </section>
    <div class="bible-version-picker" role="group" aria-label="${text("Idioma de la Biblia", "Bible language")}"><button data-action="switch-bible-version" data-version="kjv" class="${state.bibleVersion === "kjv" ? "active" : ""}">${dualText("Biblia en inglés", "Bible in English")}</button><button data-action="switch-bible-version" data-version="mi-biblia" class="${state.bibleVersion === "mi-biblia" ? "active" : ""}">${dualText("Biblia en español", "Bible in Spanish")}</button></div>
    <label class="search-box">${icon("search")}<input id="bible-search" type="search" value="${escapeHtml(state.searchQuery || "")}" placeholder="${text(`Buscar en ${version.label}`, `Search ${version.label}`)}" /><kbd>⌘ K</kbd></label>
    ${(state.searchQuery || "") ? `<section class="search-results"><div class="section-title"><h2>${dualText("Resultados", "Results")}</h2><small>${state.fullSearchLoading ? dualText("Buscando…", "Searching…") : results.length}</small></div>${results.length ? results.map(renderSearchResult).join("") : `<div class="empty-state">${state.fullSearchLoading ? dualText("Buscando en 31.102 versículos…", "Searching 31,102 verses…") : dualText("No encontramos resultados.", "No results found.")}</div>`}</section>` : ""}
    <button class="reading-plan-card" data-action="open-reading-plan">
      <span class="plan-art">365</span><div><span class="eyebrow">${dualText("PLAN DE LECTURA", "READING PLAN")}</span><h3>${dualText("La Biblia en un año", "The Bible in one year")}</h3><p>${dualText(`${state.completedPlanDays.length} de 365 días completados`, `${state.completedPlanDays.length} of 365 days completed`)}</p><div class="progress-track"><span style="width:${state.completedPlanDays.length / READING_PLAN_DAYS * 100}%"></span></div></div>${icon("chevron")}
    </button>
    <section class="book-index">
      <div class="index-tabs"><button class="active">${dualText("Libros", "Books")}</button><button>${dualText("Capítulos", "Chapters")}</button><button>${dualText("Guardados", "Saved")}</button></div>
      <div class="testament-label"><span>${dualText("Antiguo y Nuevo Testamento", "Old & New Testament")}</span><small>${state.bibleVersion === "kjv" ? dualText("Biblia en inglés", "Bible in English") : dualText("Biblia en español", "Bible in Spanish")} · ${dualText("completa · 66 libros", "complete · 66 books")}</small></div>
      ${books.map((book, index) => `<button class="book-row" data-action="open-book" data-book-id="${book.id}"><span class="book-number">${String(index + 1).padStart(2, "0")}</span><div><strong>${dualText(book.es, book.en)}</strong><small>${book.chapters} ${dualText("capítulos", "chapters")}</small></div><span class="book-progress">${getCompletedBookProgress(book.id, state.completedPlanDays)}%</span>${icon("chevron")}</button>`).join("")}
    </section>
    <details class="license-notice"><summary>${dualText("Información de las versiones", "Version information")}</summary><p>${text("Biblia en inglés: King James Version 1769. Biblia en español: texto extraído exclusivamente de Mi Biblia traducida.pdf. Cada una contiene 66 libros y 31.102 referencias.", "English Bible: King James Version 1769. Spanish Bible: text extracted exclusively from Mi Biblia traducida.pdf. Each contains 66 books and 31,102 references.")}</p></details>`;
}

function renderSearchResult(verse) {
  if (verse.type === "book") {
    return `<button class="search-result book-search-result" data-action="open-book" data-book-id="${verse.bookId}"><div><strong>${dualText(verse.book.es, verse.book.en)}</strong><p>${dualText(`${verse.chapterCount} capítulos`, `${verse.chapterCount} chapters`)}</p></div>${icon("chevron")}</button>`;
  }
  if (verse.bookId) {
    return `<button class="search-result" data-action="open-bible-verse" data-version="${verse.version}" data-book-id="${verse.bookId}" data-chapter="${verse.chapter}" data-verse-number="${verse.verse}"><div><strong>${escapeHtml(verse.reference)} · ${verse.version === "kjv" ? text("Biblia en inglés", "English Bible") : text("Biblia en español", "Spanish Bible")}</strong><p>${escapeHtml(verse.text)}</p></div>${icon("chevron")}</button>`;
  }
  return `<button class="search-result" data-action="open-reader" data-verse="${verse.id}"><div><strong>${verse.reference[state.uiLang]}</strong><p>${verse[state.uiLang]}</p></div>${icon("chevron")}</button>`;
}

function renderKjvChapter() {
  const book = books.find((item) => item.id === state.selectedBookId) || books[0];
  const chapter = state.selectedChapter;
  const verses = state.kjvChapter || [];
  const version = BIBLE_VERSIONS[state.bibleVersion] || BIBLE_VERSIONS.kjv;
  const planDay = getReadingPlanDay(state.activePlanDay);
  const planChapterIndex = planDay ? findReadingPlanChapter(planDay.day, book.id, chapter) : -1;
  const planNavigation = planDay && planChapterIndex >= 0;
  const planCompleted = planDay ? state.completedPlanDays.includes(planDay.day) : false;
  return `
    ${planNavigation ? `<section class="plan-session-card"><div><span class="eyebrow">${dualText(`DÍA ${planDay.day} · PLAN ANUAL`, `DAY ${planDay.day} · YEAR PLAN`)}</span><strong>${escapeHtml(planDay.labels[state.uiLang])}</strong><small>${dualText(`Lectura ${planChapterIndex + 1} de ${planDay.chapters.length}`, `Reading ${planChapterIndex + 1} of ${planDay.chapters.length}`)}</small></div><span class="plan-session-progress">${planChapterIndex + 1}/${planDay.chapters.length}</span></section>` : ""}
    <section class="chapter-heading">
      <span>${version.id === "kjv" ? dualText("BIBLIA EN INGLÉS", "ENGLISH BIBLE") : dualText("BIBLIA EN ESPAÑOL", "SPANISH BIBLE")}</span>
      <h1>${book[state.uiLang]} ${chapter}</h1>
      <p>${text("Selecciona una o varias palabras y toca Traducir.", "Select one or more words, then tap Translate.")}</p>
      <div class="version-toggle chapter-version-toggle"><button data-action="switch-bible-version" data-version="kjv" class="${version.id === "kjv" ? "active" : ""}">${text("Inglés", "English")}</button><button data-action="switch-bible-version" data-version="mi-biblia" class="${version.id === "mi-biblia" ? "active" : ""}">${text("Español", "Spanish")}</button></div>
    </section>
    <nav class="chapter-switcher">
      ${planNavigation
        ? `<button data-action="plan-previous-reading" ${planChapterIndex <= 0 ? "disabled" : ""}>← ${text("Anterior", "Previous")}</button><span>${dualText(`Plan · ${planChapterIndex + 1} de ${planDay.chapters.length}`, `Plan · ${planChapterIndex + 1} of ${planDay.chapters.length}`)}</span><button data-action="${planChapterIndex === planDay.chapters.length - 1 ? (planCompleted ? "return-reading-plan" : "complete-plan-day") : "plan-next-reading"}">${planChapterIndex === planDay.chapters.length - 1 ? (planCompleted ? text("Volver al plan", "Back to plan") : text("Completar día", "Complete day")) : text("Siguiente", "Next")} →</button>`
        : `<button data-action="previous-chapter" ${chapter <= 1 ? "disabled" : ""}>← ${text("Anterior", "Previous")}</button><span>${text("Capítulo", "Chapter")} ${chapter} / ${book.chapters}</span><button data-action="next-chapter" ${chapter >= book.chapters ? "disabled" : ""}>${text("Siguiente", "Next")} →</button>`}
    </nav>
    ${state.kjvLoading ? `<div class="chapter-loading">${text("Abriendo el texto bíblico verificado…", "Opening the verified Bible text…")}</div>` : ""}
    ${state.kjvError ? `<div class="empty-state">${escapeHtml(state.kjvError)}</div>` : ""}
    <article class="kjv-chapter">
      ${verses.map((value, verse) => {
        if (!value) return "";
        const record = chapterVerseRecord(value, verse, version, book, chapter);
        return `<section id="bible-verse-${verse}" class="chapter-verse ${state.selectedKjvVerse === verse ? "focused" : ""} ${highlightClass(record.key)}" ${verseHostAttributes(record)}><p class="kjv-verse"><sup>${verse}</sup>${renderInteractiveText(value)}</p>${renderSelectionBar()}${renderVerseTools(record, true)}</section>`;
      }).join("")}
    </article>
    <aside class="kjv-source-note">${version.id === "kjv" ? `KJV 1769 · eBible.org / Crosswire Bible Society · ${text("Dominio público fuera del Reino Unido", "Public domain outside the United Kingdom")}` : `Mi Biblia traducida.pdf · ${text("Texto aportado por el propietario del proyecto", "Text supplied by the project owner")}`}</aside>`;
}

function renderDailyQuiz(quiz, type, position) {
  const selectedIndex = state.dailyQuizAnswers?.[type];
  const answered = Number.isInteger(selectedIndex);
  const correct = selectedIndex === quiz.correctIndex;
  const label = type === "language" ? dualText("IDIOMA", "LANGUAGE") : dualText("BIBLIA", "BIBLE");
  return `
    <section class="quiz-card daily-quiz-${type}">
      <div class="quiz-meta"><span>${dualText(`PREGUNTA ${position} DE 2`, `QUESTION ${position} OF 2`)} · ${label}</span><span class="difficulty">${dualText("Diaria", "Daily")}</span></div>
      ${spotIllustration("quiz", "quiz-symbol")}
      <h2>${dualObject(quiz.prompt)}</h2>
      <p class="quiz-context">${dualObject(quiz.context)}</p>
      <div class="answer-grid">${quiz.options.map((answer, index) => {
        const isCorrect = index === quiz.correctIndex;
        const selected = index === selectedIndex;
        const answerCopy = quiz.answerLanguage
          ? escapeHtml(answer[quiz.answerLanguage])
          : (answer.es === answer.en ? escapeHtml(answer.es) : dualObject(answer));
        return `<button class="answer-option ${selected ? (isCorrect ? "correct" : "incorrect") : ""} ${answered && isCorrect ? "reveal-correct" : ""}" data-action="quiz-answer" data-quiz-type="${type}" data-option-index="${index}" ${answered ? "disabled" : ""}>${answerCopy}${selected || (answered && isCorrect) ? icon(isCorrect ? "check" : "close") : ""}</button>`;
      }).join("")}</div>
      ${answered ? `<div class="answer-feedback ${correct ? "success" : "try-again"}"><strong>${correct ? dualText("¡Muy bien! +20 XP", "Great job! +20 XP") : dualText("Revisa la respuesta correcta", "Review the correct answer")}</strong><p>${dualObject(quiz.explanation)}</p></div>` : ""}
    </section>`;
}

function renderLearn() {
  const quizzes = getDailyQuizSet();
  const answeredCount = ["language", "bible"].filter((type) => Number.isInteger(state.dailyQuizAnswers?.[type])).length;
  const stats = state.quizStats || { answered: 0, correct: 0, wordsLearned: 0 };
  const accuracy = stats.answered ? Math.round(stats.correct / stats.answered * 100) : 0;
  return `
    <section class="page-heading learn-heading"><div><span class="eyebrow">${dualText("LECCIÓN DIARIA", "DAILY LESSON")}</span><h1>${dualText("Aprende con la Palabra", "Learn through the Word")}</h1><p>${dualText("Cada día: un reto de idioma y otro de la Biblia.", "Every day: one language challenge and one Bible challenge.")}</p></div><div class="lesson-xp">${icon("star")}<b>${state.points}</b> XP</div></section>
    <div class="lesson-progress"><span style="width:${answeredCount / 2 * 100}%"></span></div>
    ${renderDailyQuiz(quizzes.language, "language", 1)}
    ${renderDailyQuiz(quizzes.bible, "bible", 2)}
    <section class="learning-stats"><article><span>${stats.wordsLearned || 0}</span>${dualText("palabras aprendidas", "words learned")}</article><article><span>${accuracy}%</span>${dualText("precisión", "accuracy")}</article><article><span>${state.streak}</span>${dualText("días de racha", "streak days")}</article></section>`;
}

function renderProfile() {
  const initials = state.account ? state.account.name.slice(0, 1).toUpperCase() : "T";
  return `
    <section class="profile-hero">
      <button class="theme-float" data-action="toggle-theme">${icon(state.dark ? "sun" : "moon")}</button>
      <div class="profile-avatar">${escapeHtml(initials)}<span>✦</span></div>
      <h1>${state.account ? escapeHtml(state.account.name) : dualText("Tu camino", "Your journey")}</h1>
      <p>${state.account ? escapeHtml(state.account.email) : dualText("Tu progreso está guardado en este dispositivo", "Your progress is saved on this device")}</p>
      ${state.account ? `<span class="synced-pill">${icon("check")} ${dualText("Cuenta verificada · progreso integrado", "Verified account · progress synced")}</span>` : `<button class="primary-button light" data-action="open-account">${dualText("Crear cuenta y conservar progreso", "Create account & keep progress")}</button>`}
    </section>
    <section class="profile-content">
      <div class="profile-stat-grid"><article>${icon("flame")}<strong>${state.streak}</strong>${dualText("racha actual", "current streak")}</article><article>${icon("star")}<strong>${state.points}</strong>${dualText("puntos", "points")}</article><article>${icon("heart")}<strong>${state.favorites.length}</strong>${dualText("favoritos", "favorites")}</article></div>
      <section class="premium-card ${state.premium ? "is-premium" : ""}"><span class="crown-bubble">${spotIllustration("premium")}</span><div><span class="eyebrow">DUOBIBLIA PREMIUM</span><h2>${state.premium ? text("Tu plan está activo", "Your plan is active") : text("Al precio de un café y un pan", "For the price of coffee and bread")}</h2><p>${text("Sin anuncios, audio completo y lectura sin conexión.", "No ads, full audio and offline reading.")}</p><strong>$2 USD / ${text("mes", "month")}</strong></div><button data-action="open-premium">${state.premium ? text("Administrar", "Manage") : text("Ver plan", "See plan")}</button></section>
      <section class="settings-list">
        <h2>${dualText("Tu biblioteca", "Your library")}</h2>
        <button data-action="show-favorites"><span class="setting-icon coral">${spotIllustration("favorite")}</span><div><strong>${dualText("Versículos favoritos", "Favorite verses")}</strong><small>${state.favorites.length} ${dualText("guardados", "saved")}</small></div>${icon("chevron")}</button>
        <button data-action="show-notes"><span class="setting-icon gold">${spotIllustration("note")}</span><div><strong>${dualText("Mis notas", "My notes")}</strong><small>${Object.keys(state.notes).length} ${dualText("notas personales", "personal notes")}</small></div>${icon("chevron")}</button>
        <button data-action="open-reading-plan"><span class="setting-icon sage">${spotIllustration("plan")}</span><div><strong>${dualText("Plan de lectura", "Reading plan")}</strong><small>${state.completedPlanDays.length}/365 ${dualText("días", "days")}</small></div>${icon("chevron")}</button>
        <button data-action="open-devotional"><span class="setting-icon gold">${spotIllustration("bible")}</span><div><strong>${dualText("Matutina anual", "Yearly morning devotional")}</strong><small>${state.completedDevotionalDays.length}/365 ${dualText("días leídos", "days read")}</small></div>${icon("chevron")}</button>
      </section>
      <section class="settings-list compact">
        <h2>${dualText("Preferencias", "Preferences")}</h2>
        <button data-action="switch-language"><span class="setting-icon blue">${spotIllustration("translate")}</span><div><strong>${dualText("Idioma de la aplicación", "App language")}</strong><small>${state.uiLang === "es" ? dualText("Español · preferido para aprender español", "Spanish · preferred for learning Spanish") : dualText("English · preferred for learning English", "Inglés · preferido para aprender inglés")}</small></div><span class="language-code">${state.uiLang.toUpperCase()}</span></button>
        <button data-action="toggle-theme"><span class="setting-icon violet">${icon(state.dark ? "sun" : "moon")}</span><div><strong>${dualText("Apariencia", "Appearance")}</strong><small>${state.dark ? dualText("Modo oscuro", "Dark mode") : dualText("Modo claro", "Light mode")}</small></div><span class="toggle ${state.dark ? "on" : ""}"><i></i></span></button>
        <button data-action="toggle-notifications"><span class="setting-icon gold">${spotIllustration("prayer")}</span><div><strong>${dualText("Recordatorios de oración", "Prayer reminders")}</strong><small>${state.notificationsEnabled ? dualText("7:00 · 15:00 · 21:30", "7:00 AM · 3:00 PM · 9:30 PM") : dualText("Desactivados", "Off")}</small></div><span class="toggle ${state.notificationsEnabled ? "on" : ""}"><i></i></span></button>
        <button data-action="ad-privacy-options"><span class="setting-icon blue">${icon("shield")}</span><div><strong>${dualText("Privacidad de anuncios", "Ad privacy")}</strong><small>${dualText("Revisar opciones de consentimiento", "Review consent choices")}</small></div>${icon("chevron")}</button>
        <button data-action="open-privacy-policy"><span class="setting-icon sage">${icon("shield")}</span><div><strong>${dualText("Política de privacidad", "Privacy policy")}</strong><small>${dualText("Datos, proveedores y eliminación", "Data, providers, and deletion")}</small></div>${icon("chevron")}</button>
        ${state.account ? `<button data-action="sign-out"><span class="setting-icon coral">${icon("close")}</span><div><strong>${text("Cerrar sesión", "Sign out")}</strong><small>${text("El progreso local permanece en este dispositivo", "Local progress stays on this device")}</small></div>${icon("chevron")}</button>` : ""}
        ${state.account ? `<button class="delete-account-setting" data-action="open-delete-account"><span class="setting-icon coral">${icon("trash")}</span><div><strong>${dualText("Eliminar cuenta y datos", "Delete account and data")}</strong><small>${dualText("Esta acción es permanente", "This action is permanent")}</small></div>${icon("chevron")}</button>` : ""}
      </section>
      <p class="version-label">DuoBiblia · ${APP_VERSION}</p>
    </section>`;
}

async function loadYouthDevotionalContent() {
  if (state.devotionalContent) return state.devotionalContent;
  if (!devotionalLoadPromise) devotionalLoadPromise = import("./src/devotional-year.mjs");
  setState({ devotionalLoading: true, devotionalError: null }, false);
  try {
    const module = await devotionalLoadPromise;
    setState({ devotionalContent: module.devotionalYear, devotionalLoading: false, devotionalError: null }, false);
    return module.devotionalYear;
  } catch (error) {
    devotionalLoadPromise = null;
    setState({ devotionalLoading: false, devotionalError: error.message || "Devotional unavailable" }, false);
    return null;
  }
}

function renderYouthDevotional() {
  if (!state.devotionalContent) {
    return `<section class="matutina-loading"><span class="matutina-hero-mark"><span>V</span><small>365</small></span><p class="eyebrow">${dualText("MATUTINA PARA ADOLESCENTES", "MORNING DEVOTIONAL FOR TEENS")}</p><h1>${escapeHtml(DEVOTIONAL_TITLE)}</h1><p>${state.devotionalError ? dualText("No pudimos abrir el contenido. Inténtalo de nuevo.", "We couldn't open the content. Please try again.") : dualText("Abriendo la lectura de hoy…", "Opening today's reading…")}</p>${state.devotionalError ? `<button class="primary-button" data-action="retry-devotional">${dualText("Reintentar", "Try again")}</button>` : `<span class="translation-loader">${icon("bible")}</span>`}</section>`;
  }
  const index = Math.max(0, Math.min(DEVOTIONAL_DAYS - 1, Number(state.devotionalDay) || 0));
  const day = state.devotionalContent.days[index];
  const completed = state.completedDevotionalDays.includes(day.id);
  const date = new Date(2025, day.month - 1, day.day);
  const dateLabel = new Intl.DateTimeFormat(state.uiLang === "es" ? "es-CO" : "en-US", { day: "numeric", month: "long" }).format(date);
  const verseRecord = {
    key: day.bookId ? `bible:mi-biblia:${day.bookId}:${day.chapter}:${day.verse}` : `devotional-verse:${day.id}`,
    text: day.verseQuote,
    reference: day.reference,
    sourceLang: "es",
    version: "mi-biblia",
    bookId: day.bookId || "",
    chapter: day.chapter || "",
    verse: day.verse || ""
  };
  const reflectionParagraphs = day.reflection.split(/\n\s*\n/).filter(Boolean);
  const challengeParagraphs = day.challenge.split(/\n\s*\n/).filter(Boolean);
  const prayerParagraphs = day.prayer.split(/\n\s*\n/).filter(Boolean);
  return `
    <article class="youth-devotional">
      <header class="matutina-hero">
        <div class="matutina-hero-mark"><span>V</span><small>${index + 1}/365</small></div>
        <p class="eyebrow">${dualText("MATUTINA PARA ADOLESCENTES", "MORNING DEVOTIONAL FOR TEENS")}</p>
        <h1>${escapeHtml(day.title)}</h1>
        <p class="matutina-date">${escapeHtml(dateLabel)} · ${escapeHtml(day.monthTheme)}</p>
        <div class="matutina-year-progress"><span style="width:${(index + 1) / DEVOTIONAL_DAYS * 100}%"></span></div>
      </header>

      <nav class="matutina-day-nav" aria-label="${text("Elegir día de la matutina", "Choose devotional day")}">
        <button class="icon-button bordered" data-action="devotional-previous" aria-label="${text("Día anterior", "Previous day")}">${icon("back")}</button>
        <label><span>${dualText("Día del año", "Day of the year")}</span><select id="devotional-picker">${state.devotionalContent.days.map((item, dayIndex) => `<option value="${dayIndex}" ${dayIndex === index ? "selected" : ""}>${dayIndex + 1}. ${escapeHtml(item.title)}</option>`).join("")}</select></label>
        <button class="icon-button bordered" data-action="devotional-next" aria-label="${text("Día siguiente", "Next day")}">${icon("chevron")}</button>
      </nav>
      <button class="matutina-today-button" data-action="devotional-today">${dualText("Volver a la matutina de hoy", "Return to today's devotional")}</button>

      <section class="matutina-section matutina-scripture ${highlightClass(verseRecord.key)}" ${verseHostAttributes(verseRecord)}>
        <span class="matutina-section-number">01</span><p class="eyebrow">${dualText("VERSÍCULO", "SCRIPTURE")}</p>
        <blockquote>“${renderInteractiveText(day.verseQuote)}”</blockquote>
        ${renderSelectionBar()}
        <strong>${escapeHtml(day.reference)}</strong>
        ${renderVerseTools(verseRecord)}
        ${day.bookId ? `<button class="matutina-open-bible" data-action="open-bible-verse" data-version="mi-biblia" data-book-id="${day.bookId}" data-chapter="${day.chapter}" data-verse-number="${day.verse}">${dualText("Leer en la Biblia", "Read in the Bible")} ${icon("chevron")}</button>` : ""}
      </section>

      <section class="matutina-section matutina-reading" ${selectionHostAttributes(`devotional:${day.id}:reading`, day.body.join("\n\n"), "es")}>
        <span class="matutina-section-number">02</span><p class="eyebrow">${dualText("LECTURA", "READING")}</p>
        <div class="matutina-prose">${renderInteractiveParagraphs(day.body)}</div>
        ${renderSelectionBar()}
      </section>

      <section class="matutina-section matutina-reflection" ${selectionHostAttributes(`devotional:${day.id}:reflection`, day.reflection, "es")}>
        <span class="matutina-section-number">03</span><p class="eyebrow">${dualText("REFLEXIÓN", "REFLECTION")}</p>
        <div class="matutina-prose">${renderInteractiveParagraphs(reflectionParagraphs)}</div>
        ${renderSelectionBar()}
      </section>

      <section class="matutina-section matutina-challenge" ${selectionHostAttributes(`devotional:${day.id}:challenge`, day.challenge, "es")}>
        <span class="matutina-section-number">04</span><p class="eyebrow">${dualText("RETO DEL DÍA", "CHALLENGE OF THE DAY")}</p>
        <div class="matutina-prose">${renderInteractiveParagraphs(challengeParagraphs)}</div>
        ${renderSelectionBar()}
      </section>

      <section class="matutina-section matutina-daily-prayer" ${selectionHostAttributes(`devotional:${day.id}:prayer`, day.prayer, "es")}>
        <span class="matutina-section-number">05</span><p class="eyebrow">${day.prayerSuggested ? dualText("ORACIÓN SUGERIDA", "SUGGESTED PRAYER") : dualText("ORACIÓN", "PRAYER")}</p>
        <div class="matutina-prose">${renderInteractiveParagraphs(prayerParagraphs)}</div>
        ${renderSelectionBar()}
        ${day.prayerSuggested ? `<small class="suggested-prayer-note">${dualText("Esta oración completa un día que no la incluía en el archivo recibido.", "This prayer completes a day that did not include one in the supplied file.")}</small>` : ""}
      </section>

      <button class="amen-button matutina-complete ${completed ? "completed" : ""}" data-action="complete-devotional">${completed ? icon("check") : ""}${completed ? dualText("Matutina completada", "Devotional completed") : dualText("Completar matutina", "Complete devotional")}</button>
      <p class="amen-hint">${dualText(`${state.completedDevotionalDays.length} de 365 días guardados automáticamente`, `${state.completedDevotionalDays.length} of 365 days saved automatically`)}</p>
      <footer class="matutina-source"><strong>${escapeHtml(DEVOTIONAL_TITLE)}</strong><span>${escapeHtml(DEVOTIONAL_SUBTITLE)}</span><small>${dualText("Contenido original entregado para DuoBiblia · selecciónalo para traducir", "Original content supplied for DuoBiblia · select it to translate")}</small></footer>
    </article>`;
}

function renderPrayer() {
  const prayer = getPrayerExperience();
  const verse = getVerse(prayer.verseId);
  const sourceLang = state.bibleVersion === "mi-biblia" ? "es" : "en";
  const versionLabel = state.bibleVersion === "mi-biblia" ? text("Biblia en español", "Spanish Bible") : text("Biblia en inglés", "English Bible");
  const track = prayerTracks.find((item) => item.id === state.currentTrackId) || prayerTracks[0];
  const secondaryLang = sourceLang === "es" ? "en" : "es";
  const done = hasCompletedPrayer(state, new Date(), prayer.period);
  const verseRecord = featuredVerseRecord(verse, sourceLang);
  return `
    <section class="prayer-hero prayer-${prayer.period}">
      <span class="eyebrow">${dualText("MOMENTO DE ORACIÓN", "PRAYER MOMENT")}<b class="local-time">${new Intl.DateTimeFormat(state.uiLang === "es" ? "es-CO" : "en-US", { hour: "numeric", minute: "2-digit" }).format(new Date())}</b></span>
      <div class="prayer-sun">${icon(prayer.iconName)}</div>
      <h1>${dualObject(prayer.intro)}</h1>
      <p>${dualText(`Selecciona una o varias palabras en ${sourceLang === "en" ? "inglés" : "español"} y toca Traducir.`, `Select one or more ${sourceLang === "en" ? "English" : "Spanish"} words, then tap Translate.`, "hero-guidance")}</p>
      <div class="prayer-music-card ${state.audioPlaying ? "playing" : "muted"}"><button class="music-orbit-button" data-action="toggle-audio" aria-label="${state.audioPlaying ? text("Pausar música", "Pause music") : text("Reproducir música", "Play music")}">${icon(state.audioPlaying ? "pause" : "music")}</button><div>${dualText(state.audioPlaying ? "SONANDO AHORA" : "MÚSICA EN PAUSA", state.audioPlaying ? "NOW PLAYING" : "MUSIC PAUSED", "music-status")}<strong>${dualObject(track.label, "track-copy")}</strong></div><button class="music-next-button" data-action="next-track" aria-label="${text("Siguiente canción", "Next track")}">${icon("skip")}</button><i class="music-equalizer"><b></b><b></b><b></b><b></b></i></div>
    </section>
    <article class="devotional-content">
      <section class="devotional-section verse-section ${highlightClass(verseRecord.key)}" ${verseHostAttributes(verseRecord)}>
        <span class="section-number">01</span><p class="eyebrow">${dualText("VERSÍCULO DEL DÍA", "VERSE OF THE DAY")}</p>
        <div class="interactive-verse" data-source-lang="${sourceLang}" data-verse-context="${escapeHtml(verse[sourceLang])}">${renderInteractiveText(verse[sourceLang])}</div>
        ${renderSelectionBar()}
        <strong class="scripture-ref">${verse.reference[sourceLang]} · ${versionLabel}</strong>
        <p class="devotional-secondary scripture-secondary" lang="${secondaryLang}">${escapeHtml(verse[secondaryLang])}</p>
        ${renderVerseTools(verseRecord)}
      </section>
      <section class="devotional-section meditation-section" ${selectionHostAttributes(`devotional:${dateKey()}:meditation:${state.uiLang}`, prayer.meditation[state.uiLang], state.uiLang, prayer.meditation[opposite()], text("Meditación", "Meditation"))}>
        <span class="section-number">02</span><p class="eyebrow">${dualText("MEDITACIÓN", "MEDITATION")}</p>
        <h2>${dualObject(prayer.meditationTitle)}</h2>
        <p class="devotional-interactive-text">${renderInteractiveText(prayer.meditation[state.uiLang])}</p>
        ${renderSelectionBar()}
        <blockquote class="devotional-secondary" lang="${opposite()}">${escapeHtml(prayer.meditation[opposite()])}</blockquote>
      </section>
      <section class="devotional-section pray-section" ${selectionHostAttributes(`devotional:${dateKey()}:prayer:${state.uiLang}`, prayer.prayer[state.uiLang], state.uiLang, prayer.prayer[opposite()], text("Oración", "Prayer"))}>
        <span class="section-number">03</span><p class="eyebrow">${dualText("OREMOS", "LET US PRAY")}</p>
        <h2>${dualObject(prayer.prayerTitle)}</h2>
        <p class="devotional-interactive-text">${renderInteractiveText(prayer.prayer[state.uiLang])}</p>
        ${renderSelectionBar()}
        <p class="devotional-secondary" lang="${opposite()}">${escapeHtml(prayer.prayer[opposite()])}</p>
      </section>
      <button class="amen-button ${done ? "completed" : ""}" data-action="amen">${done ? icon("check") : ""}${done ? dualText("Momento completado", "Moment completed") : dualText("Amén", "Amen")}</button>
      <p class="amen-hint">${done ? dualText("Este momento quedó guardado. La próxima oración se habilitará en su horario.", "This moment is saved. The next prayer will be available in its time period.") : dualText("Completa la oración para cuidar tu racha", "Complete the prayer to protect your streak")}</p>
    </article>`;
}

function renderInteractiveTokens(value, tokenState) {
  return value.split(/(\s+)/).map((token) => {
    if (/^\s+$/.test(token)) return token;
    const index = tokenState.index++;
    return `<button class="word-token" data-action="select-word" data-token-index="${index}" data-word="${escapeHtml(token)}">${escapeHtml(token)}</button>`;
  }).join("");
}

function renderInteractiveText(value) {
  return renderInteractiveTokens(value, { index: 0 });
}

function renderInteractiveParagraphs(paragraphs) {
  const tokenState = { index: 0 };
  return paragraphs.map((paragraph) => `<p>${renderInteractiveTokens(paragraph, tokenState)}</p>`).join("");
}

function renderReader() {
  const verse = getVerse(state.selectedVerseId);
  const sourceLang = state.bibleVersion === "mi-biblia" ? "es" : "en";
  const targetLang = sourceLang === "en" ? "es" : "en";
  const sourceVersion = sourceLang === "en" ? text("Biblia en inglés", "English Bible") : text("Biblia en español", "Spanish Bible");
  const targetVersion = targetLang === "en" ? text("Biblia en inglés", "English Bible") : text("Biblia en español", "Spanish Bible");
  const isFavorite = state.favorites.includes(verse.id);
  const note = state.notes[verse.id];
  const presentation = getReaderPresentation(verse.id);
  const verseRecord = featuredVerseRecord(verse, sourceLang);
  return `
    <div class="reader-shell ${highlightClass(verseRecord.key)}" ${verseHostAttributes(verseRecord)}>
    <section class="reader-toolbar">
      <div class="version-toggle"><button data-action="switch-bible-version" data-version="kjv" class="${sourceLang === "en" ? "active" : ""}">${text("Inglés", "English")}</button><button data-action="switch-bible-version" data-version="mi-biblia" class="${sourceLang === "es" ? "active" : ""}">${text("Español", "Spanish")}</button></div>
      ${renderVerseTools(verseRecord)}
    </section>
    <article class="reader-page">
      <header><span>${dualText(`${verse.book.es.toUpperCase()} · ${sourceLang === "es" ? sourceVersion : targetVersion}`, `${verse.book.en.toUpperCase()} · ${sourceLang === "en" ? sourceVersion : targetVersion}`)}</span><h1>${dualText(verse.reference.es, verse.reference.en)}</h1><p>${dualText("Selecciona una o varias palabras y después toca Traducir", "Select one or more words, then tap Translate")}</p></header>
      <div class="chapter-rule"><span>${verse.chapter}</span></div>
      <p class="reader-verse" data-source-lang="${sourceLang}" data-verse-context="${escapeHtml(verse[sourceLang])}"><sup>${verse.verse}</sup>${renderInteractiveText(verse[sourceLang])}</p>
      ${renderSelectionBar()}
      <div class="phrase-actions"><button data-action="translate-phrase" data-phrase="${escapeHtml(sourceLang === "en" ? presentation.phrase : presentation.phraseEs)}" data-translation="${escapeHtml(sourceLang === "en" ? presentation.phraseEs : presentation.phrase)}">${icon("translate")} ${dualText(presentation.phraseEs, presentation.phrase)}</button><button data-action="translate-verse" data-verse="${verse.id}">${dualText("Traducir versículo", "Translate verse")}</button></div>
      <aside class="parallel-translation"><span>${targetVersion} · ${targetLang === "en" ? "ENGLISH" : "ESPAÑOL"}</span><p>${verse[targetLang]}</p></aside>
      ${note ? `<aside class="saved-note"><span>${icon("note")} ${dualText("TU NOTA", "YOUR NOTE")}</span><p>${escapeHtml(note)}</p><button data-action="open-note" data-verse="${verse.id}">${dualText("Editar", "Edit")}</button></aside>` : ""}
      <section class="reader-context"><span class="eyebrow">${dualText("PARA COMPRENDER", "FOR UNDERSTANDING")}</span><h2>${dualObject(presentation.title)}</h2><p>${presentation.description[state.uiLang]}</p><p class="reader-context-secondary">${escapeHtml(presentation.description[opposite()])}</p></section>
      <nav class="verse-pager"><button data-action="previous-verse">← ${dualText("Anterior", "Previous")}</button><span>${featuredVerses.findIndex((item) => item.id === verse.id) + 1} / ${featuredVerses.length}</span><button data-action="next-verse">${dualText("Siguiente", "Next")} →</button></nav>
    </article></div>`;
}

function getReaderPresentation(verseId) {
  const presentations = {
    "john-14-27": {
      phrase: "Peace I leave with you", phraseEs: "La paz les dejo",
      title: { es: "Paz en su contexto", en: "Peace in context" },
      description: { es: "Aquí, “peace” no significa solamente ausencia de problemas. Habla de seguridad interior y confianza en la presencia de Jesús.", en: "Here, “peace” means more than the absence of problems. It speaks of inner security and trust in Jesus' presence." }
    },
    "psalm-34-18": {
      phrase: "The Lord is near", phraseEs: "El Señor está cerca",
      title: { es: "Cercanía en el dolor", en: "Nearness in sorrow" },
      description: { es: "“Brokenhearted” describe a quien está profundamente herido. El salmo presenta a Dios cercano, no distante, en ese momento.", en: "“Brokenhearted” describes someone deeply hurt. The psalm presents God as near, not distant, in that moment." }
    },
    "isaiah-41-10": {
      phrase: "I will strengthen you", phraseEs: "Yo te fortaleceré",
      title: { es: "Fuerza recibida", en: "Strength received" },
      description: { es: "“Strengthen” comunica la idea de dar firmeza. La promesa no exige producir valor a solas: Dios ofrece su ayuda.", en: "“Strengthen” means to make someone steadier. The promise does not demand courage alone: God offers his help." }
    },
    "philippians-4-6": {
      phrase: "through prayer", phraseEs: "por medio de la oración",
      title: { es: "De la preocupación a la oración", en: "From worry to prayer" },
      description: { es: "El pasaje transforma la preocupación en una acción concreta: presentar a Dios lo que pesa, con gratitud.", en: "The passage turns worry into a concrete action: bringing what weighs on us to God with thanksgiving." }
    },
    "psalm-23-4": {
      phrase: "the darkest valley", phraseEs: "el valle más oscuro",
      title: { es: "Compañía en el valle", en: "Company in the valley" },
      description: { es: "La seguridad del salmo no depende del camino, sino de la presencia que acompaña a quien lo recorre.", en: "The psalm's security does not depend on the path, but on the presence accompanying the person who walks it." }
    },
    "matthew-11-28": {
      phrase: "I will give you rest", phraseEs: "Yo les daré descanso",
      title: { es: "Descanso en su contexto", en: "Rest in context" },
      description: { es: "“Rest” es alivio para quien está agotado o cargado. Jesús ofrece un descanso que toca el cuerpo y el corazón.", en: "“Rest” is relief for someone weary or burdened. Jesus offers a rest that reaches both body and heart." }
    },
    "1-thessalonians-5-18": {
      phrase: "Give thanks", phraseEs: "Den gracias",
      title: { es: "Gratitud en toda circunstancia", en: "Gratitude in every circumstance" },
      description: { es: "Dar gracias “en todo” no llama bueno a todo lo que ocurre; invita a reconocer la presencia de Dios en cada momento.", en: "Giving thanks “in everything” does not call every event good; it invites us to notice God's presence in every moment." }
    }
  };
  return presentations[verseId] || presentations["john-14-27"];
}

function renderTopics() {
  const topic = topics.find((item) => item.id === state.selectedTopic) || topics[0];
  const verse = getVerse(topic.verseId);
  const verseRecord = featuredVerseRecord(verse, state.uiLang);
  return `
    <section class="topics-hero">${spotIllustration(({ amor: "favorite", paz: "prayer", fe: "bible", perdon: "note", bendiciones: "streak", salvacion: "premium" })[topic.id] || "bible")}<p class="eyebrow">${dualText("PALABRAS DE DIOS PARA HOY", "GOD'S WORDS FOR TODAY")}</p><h1>${dualObject(topic.label)}</h1><p>${dualText("Versículos seleccionados para este momento de tu camino.", "Verses selected for this moment in your journey.")}</p></section>
    <div class="topic-selector">${topics.map(renderTopicChip).join("")}</div>
    <article class="topic-verse-card ${highlightClass(verseRecord.key)}" ${verseHostAttributes(verseRecord)}><button class="topic-reference-button" data-action="open-reader" data-verse="${verse.id}">${dualText(verse.reference.es, verse.reference.en)} ${icon("chevron")}</button><blockquote>“${renderInteractiveText(verse[state.uiLang])}”</blockquote>${renderSelectionBar()}${renderVerseTools(verseRecord)}<small>${dualText("Toca varias palabras y traduce la selección completa", "Tap several words and translate the full selection")}</small></article>
    <article class="curiosity-card"><span class="curiosity-icon">?</span><div><p class="eyebrow">${dualText("¿SABÍAS QUE...?", "DID YOU KNOW?")}</p><h3>${dualText("La palabra “paz” tiene una historia profunda", "The word “peace” has a deep history")}</h3><p>${dualText("El concepto bíblico de shalom abarca bienestar, integridad, armonía y plenitud, no solamente ausencia de conflicto.", "The biblical idea of shalom includes well-being, wholeness, harmony, and flourishing—not only the absence of conflict.")}</p></div></article>`;
}

function renderReadingPlan() {
  const week = Math.max(1, Math.min(53, Number(state.readingPlanWeek) || 1));
  const days = getReadingPlanWeek(week);
  const completed = new Set(state.completedPlanDays.map(Number));
  const completedCount = completed.size;
  const weekCompleted = days.filter((day) => completed.has(day.day)).length;
  const percent = Math.round(completedCount / READING_PLAN_DAYS * 100);
  return `
    <section class="plan-hero"><span class="plan-big-number">365</span><div><p class="eyebrow">${dualText("UN AÑO EN LA PALABRA", "ONE YEAR IN THE WORD")}</p><h1>${dualText("La Biblia completa", "The complete Bible")}</h1><p>${dualText("Lecturas equilibradas de 12–15 minutos al día.", "Balanced readings of 12–15 minutes a day.")}</p></div></section>
    <section class="plan-summary"><article><strong>${completedCount}</strong>${dualText("días leídos", "days read")}</article><article><strong>${percent}%</strong>${dualText("completado", "complete")}</article><article><strong>${state.streak}</strong>${dualText("racha", "streak")}</article></section>
    <section class="plan-days"><div class="plan-week-heading"><button data-action="plan-week" data-delta="-1" ${week <= 1 ? "disabled" : ""} aria-label="${text("Semana anterior", "Previous week")}">${icon("back")}</button><div><h2>${dualText(`Semana ${week} de 53`, `Week ${week} of 53`)}</h2><small>${weekCompleted} / ${days.length} ${dualText("días completados", "days complete")}</small></div><button data-action="plan-week" data-delta="1" ${week >= 53 ? "disabled" : ""} aria-label="${text("Semana siguiente", "Next week")}">${icon("chevron")}</button></div>${days.map((day) => { const done = completed.has(day.day); return `<button class="plan-day ${done ? "done" : ""}" data-action="plan-day" data-day="${day.day}"><span>${done ? icon("check") : day.day}</span><div><strong>${dualText(`Día ${day.day}`, `Day ${day.day}`)}</strong><small>${escapeHtml(day.labels[state.uiLang])}</small></div><em>${done ? text("Completado", "Complete") : `${day.minutes} min`}</em>${icon("chevron")}</button>`; }).join("")}</section>`;
}

function renderModal() {
  if (!state.modal) return "";
  const close = `<button class="modal-close" data-action="close-modal">${icon("close", text("Cerrar", "Close"))}</button>`;
  if (state.modal.type === "mood-verse") {
    const verse = getMoodVerse(state.modal.moodId);
    const mood = moodOptions.find((item) => item.id === state.modal.moodId);
    const record = featuredVerseRecord(verse, state.uiLang);
    return `<div class="modal-layer mood-result-layer"><div class="modal-card mood-result ${highlightClass(record.key)}" ${verseHostAttributes(record)}>${close}<span class="result-emoji">${mood.emoji}</span><p class="eyebrow">${dualText("UNA PALABRA PARA TI", "A WORD FOR YOU")}</p><h2>${dualText("No tienes que cargar esto solo.", "You don't have to carry this alone.")}</h2><blockquote>“${renderInteractiveText(verse[state.uiLang])}”</blockquote>${renderSelectionBar()}<strong>${dualText(verse.reference.es, verse.reference.en)}</strong>${renderVerseTools(record)}<button class="primary-button" data-action="read-mood-verse" data-verse="${verse.id}">${dualText("Leer en la Biblia", "Read in the Bible")}</button><button class="secondary-button" data-action="continue-home">${dualText("Ir al inicio", "Go home")}</button></div></div>`;
  }
  if (state.modal.type === "notifications") {
    return `<div class="modal-layer"><div class="modal-card notification-modal">${close}<span class="notification-orbit">${icon("bell")}</span><p class="eyebrow">${text("UN RITMO PARA TU DÍA", "A RHYTHM FOR YOUR DAY")}</p><h2>${text("¿Te acompañamos a orar?", "May we remind you to pray?")}</h2><p>${text("Recibe recordatorios suaves a las 7:00, 15:00 y 21:30 según la hora local de tu celular.", "Receive gentle reminders at 7:00 AM, 3:00 PM, and 9:30 PM in your phone's local time.")}</p><div class="notification-times"><span>☀ <b>7:00</b></span><span>✦ <b>15:00</b></span><span>☾ <b>21:30</b></span></div><button class="primary-button" data-action="enable-notifications">${text("Activar recordatorios", "Enable reminders")}</button><button class="secondary-button" data-action="close-modal">${text("Ahora no", "Not now")}</button><small>${text("Puedes cambiarlos después en Perfil · Preferencias.", "You can change them later in Profile · Preferences.")}</small></div></div>`;
  }
  if (state.modal.type === "translation") {
    const help = state.modal.help;
    return `<div class="modal-layer bottom-layer" data-action="close-on-backdrop"><div class="bottom-sheet">${close}<div class="sheet-handle"></div><div class="translation-heading"><div><span class="eyebrow">${text("TRADUCCIÓN EN CONTEXTO", "CONTEXTUAL TRANSLATION")}</span><h2>${escapeHtml(state.modal.word)}</h2></div><button class="sound-button" data-action="speak-word" data-word="${escapeHtml(state.modal.word)}" data-language="${state.modal.sourceLang || "en"}">${icon("volume")}</button></div><div class="translation-main"><strong>${escapeHtml(help.translated ?? help.es)}</strong><span>${escapeHtml(help.pronunciation)} · ${escapeHtml(help.type)}</span></div><p>${escapeHtml(help.meaning)}</p><div class="context-box ${help.parallelText ? "bible-parallel-box" : ""}"><span>${help.parallelText ? dualText("FRAGMENTO BÍBLICO EQUIVALENTE", "EQUIVALENT BIBLE FRAGMENT") : text("EN ESTA FRASE", "IN THIS PHRASE")}</span><strong>${escapeHtml(help.parallelReference || help.phrase)}</strong>${help.parallelText ? `<small>${escapeHtml(help.phrase)}</small>` : ""}<p>${escapeHtml(help.phraseEs)}</p></div><button class="primary-button" data-action="close-modal">${text("Entendido", "Got it")}</button></div></div>`;
  }
  if (state.modal.type === "translation-loading") {
    return `<div class="modal-layer bottom-layer"><div class="bottom-sheet translation-loading-sheet">${close}<div class="sheet-handle"></div><span class="translation-loader">${icon("translate")}</span><h2>${dualText("Preparando traducción", "Preparing translation")}</h2><p>${dualText("Buscando el pasaje paralelo y conservando su contexto…", "Finding the parallel passage and preserving its context…")}</p></div></div>`;
  }
  if (state.modal.type === "verse-translation") {
    const source = state.modal.source || featuredVerseRecord(getVerse(state.modal.verseId), state.uiLang);
    const target = state.modal.target || featuredVerseRecord(getVerse(state.modal.verseId), source.sourceLang === "en" ? "es" : "en");
    return `<div class="modal-layer bottom-layer"><div class="bottom-sheet verse-translation-sheet">${close}<div class="sheet-handle"></div><p class="eyebrow">${dualText("VERSÍCULO COMPLETO", "FULL VERSE")}</p><h2>${escapeHtml(source.reference)}</h2><blockquote>${escapeHtml(source.text)}</blockquote><div class="translation-divider">${icon("translate")}</div><h3>${escapeHtml(target.reference)}</h3><p class="full-translation">${escapeHtml(target.text)}</p><small>${dualText("La traducción palabra por palabra puede variar; aquí se muestra el sentido completo en contexto.", "Word-for-word translation may vary; this shows the full meaning in context.")}</small><button class="primary-button" data-action="close-modal">${dualText("Continuar leyendo", "Keep reading")}</button></div></div>`;
  }
  if (state.modal.type === "verse-tools") {
    const record = state.modal.record || resolveVerseRecord(state.modal.verseKey);
    if (!record) return "";
    return `<div class="modal-layer bottom-layer" data-action="close-on-backdrop"><div class="bottom-sheet verse-tools-sheet ${highlightClass(record.key)}" ${verseHostAttributes(record)}>${close}<div class="sheet-handle"></div><p class="eyebrow">${dualText("ACCIONES DEL VERSÍCULO", "VERSE ACTIONS")}</p><h2>${escapeHtml(record.reference)}</h2><blockquote>“${escapeHtml(record.text)}”</blockquote>${renderVerseTools(record)}<p class="verse-tools-hint">${dualText("Guarda, escribe una nota, cambia el color, comparte una imagen o abre la traducción paralela.", "Save, write a note, change its color, share an image, or open the parallel translation.")}</p></div></div>`;
  }
  if (state.modal.type === "highlight") {
    const record = state.modal.record || resolveVerseRecord(state.modal.verseKey);
    if (!record) return "";
    const colors = [
      ["gold", "Dorado", "Gold"], ["coral", "Coral", "Coral"], ["sage", "Verde", "Green"], ["blue", "Azul", "Blue"], ["none", "Sin color", "No color"]
    ];
    return `<div class="modal-layer bottom-layer"><div class="bottom-sheet highlight-sheet" ${verseHostAttributes(record)}>${close}<div class="sheet-handle"></div><p class="eyebrow">${dualText("COLOR DEL VERSÍCULO", "VERSE COLOR")}</p><h2>${escapeHtml(record.reference)}</h2><div class="highlight-options">${colors.map(([color, es, en]) => `<button class="color-${color} ${((state.highlights[record.key] || "none") === color) ? "selected" : ""}" data-action="set-highlight" data-color="${color}"><i></i>${dualText(es, en)}${((state.highlights[record.key] || "none") === color) ? icon("check") : ""}</button>`).join("")}</div></div></div>`;
  }
  if (state.modal.type === "note") {
    const record = state.modal.record || resolveVerseRecord(state.modal.verseKey || state.modal.verseId);
    if (!record) return "";
    return `<div class="modal-layer"><form class="modal-card note-modal" id="note-form" ${verseHostAttributes(record)}>${close}<span class="modal-icon">${icon("note")}</span><p class="eyebrow">${dualText("NOTA PERSONAL", "PERSONAL NOTE")}</p><h2>${escapeHtml(record.reference)}</h2><p class="note-verse">“${escapeHtml(record.text)}”</p><label>${dualText("¿Qué quieres recordar?", "What do you want to remember?")}<textarea id="note-text" maxlength="500" placeholder="${text("Escribe tu reflexión...", "Write your reflection...")}">${escapeHtml(state.notes[record.key] || "")}</textarea></label><small class="note-autosave-status" id="note-autosave-status">${dualText("Se guarda automáticamente", "Saved automatically")}</small><button class="primary-button" data-action="save-note">${dualText("Listo", "Done")}</button></form></div>`;
  }
  if (state.modal.type === "streak") {
    return `<div class="modal-layer streak-layer"><div class="modal-card streak-celebration">${close}<div class="confetti"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="big-flame">${icon("flame")}</div><p class="eyebrow">${text("ORACIÓN COMPLETADA", "PRAYER COMPLETE")}</p><h2>${state.streak} ${text("días de racha", "day streak")}</h2><p>${text("Hoy elegiste comenzar con paz. Tu constancia está formando algo hermoso.", "Today you chose to begin in peace. Your consistency is shaping something beautiful.")}</p><div class="premium-progress"><div><span>${state.streak}</span><b>/ ${STREAK_GOAL}</b></div><div class="progress-track"><span style="width:${progressPercent(state.streak)}%"></span></div><small>${state.streak >= STREAK_GOAL ? text("¡Ganaste 1 mes Premium gratis!", "You earned 1 free Premium month!") : text(`${STREAK_GOAL - state.streak} días para 1 mes Premium gratis`, `${STREAK_GOAL - state.streak} days to 1 free Premium month`)}</small></div><span class="points-earned">${icon("star")} +50 XP</span>${state.streak >= STREAK_GOAL && !state.premium ? `<button class="primary-button" data-action="claim-streak-reward">${text("Reclamar mi mes gratis", "Claim my free month")}</button>` : ""}<button class="secondary-button" data-action="close-streak">${text("Continuar mi día", "Continue my day")}</button></div></div>`;
  }
  if (state.modal.type === "account") {
    return `<div class="modal-layer"><form class="modal-card account-modal" id="account-form">${close}<img src="./assets/app-logo.png" alt=""/><p class="eyebrow">${state.pendingPremium || state.pendingStreakReward ? text("CUENTA REQUERIDA PARA PREMIUM", "ACCOUNT REQUIRED FOR PREMIUM") : text("GUARDA TU CAMINO", "SAVE YOUR JOURNEY")}</p><h2>${text("Inicia sesión o crea tu cuenta", "Sign in or create your account")}</h2><p>${text("Tu racha, puntos, favoritos y notas se integrarán automáticamente.", "Your streak, points, favorites, and notes will sync automatically.")}</p>${!authConfigured ? `<div class="auth-config-warning">${dualText("Falta conectar Supabase.", "Supabase must be connected.")}</div>` : state.cloudProfilesEnabled === false ? `<div class="auth-config-warning">${dualText("La cuenta estará disponible al aplicar la migración incluida en Supabase.", "Accounts will be available after applying the included Supabase migration.")}</div>` : state.googleAuthEnabled === false ? `<div class="auth-config-warning">${dualText("El acceso por correo está disponible. Google se activará al configurar el proveedor en Supabase.", "Email access is available. Google will activate after its provider is configured in Supabase.")}</div>` : ""}<button type="button" class="google-auth-button" data-action="google-auth" ${state.authLoading || !authConfigured || state.cloudProfilesEnabled !== true || state.googleAuthEnabled !== true ? "disabled" : ""}><span>G</span>${dualText(state.googleAuthEnabled === false ? "Google pendiente de activación" : "Continuar con Google", state.googleAuthEnabled === false ? "Google activation pending" : "Continue with Google")}</button><div class="auth-divider"><span>${text("o con tu correo", "or use your email")}</span></div><label>Email<input id="account-email" required type="email" autocomplete="email" value="${escapeHtml(state.authEmail || "")}" placeholder="tu@email.com" /></label>${state.authError ? `<p class="auth-error">${escapeHtml(state.authError)}</p>` : ""}<button class="primary-button" data-action="send-email-code" ${state.authLoading || !authConfigured || state.cloudProfilesEnabled !== true || !state.emailAuthEnabled ? "disabled" : ""}>${state.authLoading ? text("Enviando…", "Sending…") : dualText("Enviar código de verificación", "Send verification code")}</button><small>${dualText("Recibirás un código de seis dígitos. No compartiremos tu correo.", "You'll receive a six-digit code. We won't share your email.")}</small></form></div>`;
  }
  if (state.modal.type === "email-code") {
    return `<div class="modal-layer"><form class="modal-card account-modal otp-modal" id="otp-form">${close}<img src="./assets/app-logo.png" alt=""/><p class="eyebrow">${text("VERIFICA TU CORREO", "VERIFY YOUR EMAIL")}</p><h2>${text("Escribe el código", "Enter the code")}</h2><p>${text(`Enviamos un código a ${state.authEmail}.`, `We sent a code to ${state.authEmail}.`)}</p><label>${text("Código de 6 dígitos", "6-digit code")}<input id="account-code" class="otp-input" required inputmode="numeric" autocomplete="one-time-code" minlength="6" maxlength="6" pattern="[0-9]{6}" placeholder="000000" /></label>${state.authError ? `<p class="auth-error">${escapeHtml(state.authError)}</p>` : ""}<button class="primary-button" data-action="verify-email-code" ${state.authLoading ? "disabled" : ""}>${state.authLoading ? text("Verificando…", "Verifying…") : text("Verificar y continuar", "Verify & continue")}</button><button type="button" class="secondary-button" data-action="resend-email-code">${text("Reenviar código", "Resend code")}</button></form></div>`;
  }
  if (state.modal.type === "account-success") {
    return `<div class="modal-layer"><div class="modal-card success-modal">${close}<span class="success-check">${icon("check")}</span><h2>${text("¡Progreso integrado!", "Progress merged!")}</h2><p>${text("Tu racha, puntos, notas y favoritos ahora forman parte de tu perfil.", "Your streak, points, notes, and favorites are now part of your profile.")}</p><button class="primary-button" data-action="close-modal">${text("Ir a mi perfil", "Go to my profile")}</button></div></div>`;
  }
  if (state.modal.type === "delete-account") {
    return `<div class="modal-layer"><div class="modal-card delete-account-modal">${close}<span class="modal-icon">${icon("trash")}</span><p class="eyebrow">${dualText("ELIMINACIÓN PERMANENTE", "PERMANENT DELETION")}</p><h2>${dualText("¿Eliminar tu cuenta?", "Delete your account?")}</h2><p>${dualText("Se eliminarán tu cuenta, perfil y progreso sincronizado. También se borrarán los datos locales de este dispositivo. Esta acción no se puede deshacer.", "Your account, profile, and synced progress will be deleted. Local data on this device will also be erased. This cannot be undone.")}</p>${state.authError ? `<p class="auth-error">${escapeHtml(state.authError)}</p>` : ""}<button class="danger-button" data-action="confirm-delete-account" ${state.authLoading ? "disabled" : ""}>${state.authLoading ? dualText("Eliminando…", "Deleting…") : dualText("Sí, eliminar definitivamente", "Yes, permanently delete")}</button><button class="secondary-button" data-action="close-modal">${dualText("Conservar mi cuenta", "Keep my account")}</button></div></div>`;
  }
  if (state.modal.type === "premium") {
    const billingControls = externalBillingEnabled
      ? `<button class="primary-button" data-action="activate-premium">${state.premium ? text("Renovar otro mes con Bold", "Renew another month with Bold") : text("Pagar de forma segura con Bold", "Pay securely with Bold")}</button><button class="secondary-button" data-action="verify-premium">${text("Ya pagué · Verificar", "I paid · Verify")}</button><p class="billing-email">${text("Paga usando el mismo correo de tu cuenta:", "Pay using the same email as your account:")} <strong>${escapeHtml(state.account?.email || "")}</strong></p><p class="legal-mini">${text("Cada pago aprobado añade un mes. El plan se desactiva al vencer; el cobro automático requiere activar la API recurrente de Bold para este comercio.", "Each approved payment adds one month. The plan turns off when it expires; automatic billing requires Bold's recurring API to be enabled for this merchant.")}</p>`
      : `<div class="store-billing-notice">${dualText("La compra estará disponible aquí cuando la suscripción de Google Play quede configurada.", "Purchase will be available here once the Google Play subscription is configured.")}</div>`;
    return `<div class="modal-layer premium-layer"><div class="modal-card premium-modal">${close}<div class="premium-mark">${icon("crown")}</div><p class="eyebrow">DUOBIBLIA PREMIUM</p><h2>${text("Más calma. Más aprendizaje. Sin anuncios.", "More calm. More learning. No ads.")}</h2><p class="premium-price"><strong>$2</strong><span>USD<br/>/${text("mes", "month")}</span></p><small>${text("Al precio de un café y un pan", "For the price of coffee and bread")}</small>${state.premiumUntil ? `<p class="subscription-status">${text("Activo hasta", "Active until")} <strong>${new Intl.DateTimeFormat(state.uiLang === "es" ? "es-CO" : "en-US", { dateStyle: "medium" }).format(new Date(state.premiumUntil))}</strong></p>` : ""}<ul><li>${icon("check")} ${text("Lectura y audio sin conexión", "Offline reading and audio")}</li><li>${icon("check")} ${text("Sin anuncios", "No ads")}</li><li>${icon("check")} ${text("Traducciones y notas ilimitadas", "Unlimited translations and notes")}</li></ul>${billingControls}<button class="secondary-button" data-action="close-modal">${text("Ahora no", "Not now")}</button></div></div>`;
  }
  if (state.modal.type === "payment-pending") {
    return `<div class="modal-layer"><div class="modal-card payment-pending-modal">${close}<span class="success-check">${icon("check")}</span><p class="eyebrow">BOLD</p><h2>${text("Completa el pago en la ventana segura", "Complete payment in the secure window")}</h2><p>${text("Cuando Bold confirme el pago, vuelve aquí y toca Verificar. Usa el mismo correo de tu cuenta.", "When Bold confirms payment, return here and tap Verify. Use the same email as your account.")}</p><button class="primary-button" data-action="verify-premium">${text("Verificar mi pago", "Verify my payment")}</button><button class="secondary-button" data-action="activate-premium">${text("Abrir Bold otra vez", "Open Bold again")}</button></div></div>`;
  }
  if (state.modal.type === "collection") {
    const ids = state.modal.collection === "favorites" ? state.favorites : Object.keys(state.notes);
    return `<div class="modal-layer"><div class="modal-card collection-modal">${close}<p class="eyebrow">${state.modal.collection === "favorites" ? dualText("VERSÍCULOS FAVORITOS", "FAVORITE VERSES") : dualText("MIS NOTAS", "MY NOTES")}</p><h2>${ids.length ? dualText("Tu biblioteca personal", "Your personal library") : dualText("Aún no hay elementos", "Nothing here yet")}</h2><div class="collection-list">${ids.length ? ids.map((id) => { const record = resolveVerseRecord(id); if (!record) return ""; return `<button data-action="read-collection-item" data-verse-key="${escapeHtml(id)}"><strong>${escapeHtml(record.reference)}</strong><p>${state.modal.collection === "notes" ? escapeHtml(state.notes[id]) : escapeHtml(record.text)}</p>${icon("chevron")}</button>`; }).join("") : `<p class="empty-state">${dualText("Toca el corazón o añade una nota mientras lees la Biblia.", "Tap the heart or add a note while reading the Bible.")}</p>`}</div></div></div>`;
  }
  return "";
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toastRegion.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 250); }, 2600);
}

function progressForSync() {
  return {
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    streak: state.streak,
    points: state.points,
    lastPrayerDate: state.lastPrayerDate,
    lastPrayerCompletedAt: state.lastPrayerCompletedAt,
    prayerCompletions: state.prayerCompletions,
    favorites: state.favorites,
    notes: state.notes,
    highlights: state.highlights,
    verseRecords: state.verseRecords,
    readChapters: state.completedPlanDays.length,
    completedPlanDays: state.completedPlanDays,
    completedDevotionalDays: state.completedDevotionalDays,
    devotionalDay: state.devotionalDay,
    moodDate: state.moodDate,
    quizCompleted: state.quizCompleted,
    quizAnswer: state.quizAnswer,
    lastQuizDate: state.lastQuizDate,
    lastQuizAdDate: state.lastQuizAdDate,
    dailyQuizDate: state.dailyQuizDate,
    dailyQuizAnswers: state.dailyQuizAnswers,
    dailyQuizCompleted: state.dailyQuizCompleted,
    quizStats: state.quizStats,
    uiLang: state.uiLang,
    bibleVersion: state.bibleVersion,
    progressUpdatedAt: state.progressUpdatedAt,
    progressRevision: state.progressRevision,
    fieldUpdatedAt: state.fieldUpdatedAt
  };
}

async function handleAuthSession(session) {
  if (!session?.user) {
    setState({ authUser: null, account: null, premium: false, premiumUntil: null, authLoading: false }, true);
    return;
  }
  const user = session.user;
  try {
    const profile = await syncProgress(user, progressForSync());
    let entitlement = await getEntitlement(user);
    if (state.pendingStreakReward && Number(profile?.progress?.streak || state.streak) >= STREAK_GOAL) {
      entitlement = await claimStreakReward(user);
    }
    const name = profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || text("Lector", "Reader");
    const syncedProgress = mergeProgress(profile?.progress || {}, progressForSync());
    const completingAuth = ["account", "email-code"].includes(state.modal?.type);
    setState({
      authUser: user,
      account: { userId: user.id, name, email: user.email, syncedAt: new Date().toISOString() },
      premium: entitlement.premium,
      premiumUntil: entitlement.premiumUntil,
      streak: syncedProgress.streak ?? state.streak,
      points: syncedProgress.points ?? state.points,
      lastPrayerDate: syncedProgress.lastPrayerDate ?? state.lastPrayerDate,
      lastPrayerCompletedAt: syncedProgress.lastPrayerCompletedAt ?? state.lastPrayerCompletedAt,
      prayerCompletions: syncedProgress.prayerCompletions || state.prayerCompletions,
      favorites: syncedProgress.favorites || state.favorites,
      notes: syncedProgress.notes || state.notes,
      highlights: syncedProgress.highlights || state.highlights,
      verseRecords: syncedProgress.verseRecords || state.verseRecords,
      completedPlanDays: syncedProgress.completedPlanDays || state.completedPlanDays,
      completedDevotionalDays: syncedProgress.completedDevotionalDays || state.completedDevotionalDays,
      devotionalDay: syncedProgress.devotionalDay ?? state.devotionalDay,
      readChapters: (syncedProgress.completedPlanDays || state.completedPlanDays).length,
      moodDate: syncedProgress.moodDate ?? state.moodDate,
      quizCompleted: syncedProgress.quizCompleted ?? state.quizCompleted,
      quizAnswer: syncedProgress.quizAnswer ?? state.quizAnswer,
      lastQuizDate: syncedProgress.lastQuizDate ?? state.lastQuizDate,
      lastQuizAdDate: syncedProgress.lastQuizAdDate ?? state.lastQuizAdDate,
      dailyQuizDate: syncedProgress.dailyQuizDate ?? state.dailyQuizDate,
      dailyQuizAnswers: syncedProgress.dailyQuizAnswers || state.dailyQuizAnswers,
      dailyQuizCompleted: syncedProgress.dailyQuizCompleted || state.dailyQuizCompleted,
      quizStats: syncedProgress.quizStats || state.quizStats,
      progressUpdatedAt: syncedProgress.progressUpdatedAt || state.progressUpdatedAt,
      progressRevision: syncedProgress.progressRevision ?? state.progressRevision,
      fieldUpdatedAt: syncedProgress.fieldUpdatedAt || state.fieldUpdatedAt,
      authLoading: false,
      authError: null,
      modal: state.pendingPremium || state.pendingStreakReward ? { type: "premium" } : (completingAuth ? { type: "account-success" } : state.modal),
      pendingPremium: false,
      pendingStreakReward: false
    });
  } catch (error) {
    setState({ authUser: user, authLoading: false, authError: error.message }, false);
  }
}

function navigate(route) {
  if (prayerAudio && route !== "prayer") stopPrayerMusic();
  const dailyPatch = state.dailyQuizDate === dateKey() ? {} : {
    dailyQuizDate: dateKey(),
    dailyQuizAnswers: { language: null, bible: null },
    dailyQuizCompleted: { language: false, bible: false },
    quizCompleted: false,
    quizAnswer: null
  };
  setState({ ...dailyPatch, route, modal: null });
  window.scrollTo({ top: 0, behavior: "instant" });
}

function openReader(id) {
  setState({ selectedVerseId: id, route: "reader", modal: null });
  window.scrollTo({ top: 0, behavior: "instant" });
}

async function openBibleChapter(bookId, chapter = 1, verse = null, versionId = state.bibleVersion) {
  const book = books.find((item) => item.id === bookId) || books[0];
  const version = BIBLE_VERSIONS[versionId] ? versionId : "kjv";
  const safeChapter = Math.max(1, Math.min(book.chapters, Number(chapter) || 1));
  setState({
    route: "chapter",
    selectedBookId: book.id,
    selectedChapter: safeChapter,
    bibleVersion: version,
    selectedKjvVerse: verse ? Number(verse) : null,
    kjvChapter: null,
    kjvLoading: true,
    kjvError: null,
    modal: null
  });
  window.scrollTo({ top: 0, behavior: "instant" });
  try {
    const kjvChapter = await getBibleChapter(version, book.id, safeChapter);
    setState({ kjvChapter, kjvLoading: false, kjvError: null }, false);
    if (verse) setTimeout(() => document.querySelector(`#bible-verse-${Number(verse)}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  } catch (error) {
    setState({ kjvLoading: false, kjvError: error.message }, false);
  }
}

function openReadingPlan() {
  const nextDay = nextIncompletePlanDay(state.completedPlanDays);
  setState({
    route: "reading-plan",
    readingPlanWeek: Math.ceil(nextDay / 7),
    activePlanDay: null,
    modal: null
  });
  window.scrollTo({ top: 0, behavior: "instant" });
}

async function openPlanDay(day) {
  const planDay = getReadingPlanDay(day);
  if (!planDay?.chapters.length) return;
  const first = planDay.chapters[0];
  setState({ activePlanDay: planDay.day, readingPlanWeek: planDay.week });
  await openBibleChapter(first.bookId, first.chapter);
}

async function openPlanChapterAt(index) {
  const planDay = getReadingPlanDay(state.activePlanDay);
  const chapter = planDay?.chapters[index];
  if (!chapter) return;
  await openBibleChapter(chapter.bookId, chapter.chapter);
}

let bibleSearchTimer;
async function runFullBibleSearch(query) {
  if (!query.trim()) {
    setState({ fullSearchResults: null, fullSearchLoading: false }, false);
    return;
  }
  const expectedQuery = query;
  state.fullSearchLoading = true;
  try {
    const expectedVersion = state.bibleVersion;
    const results = await searchBible(expectedVersion, expectedQuery);
    if (state.searchQuery === expectedQuery) {
      const wasFocused = document.activeElement?.id === "bible-search";
      const cursor = document.querySelector("#bible-search")?.selectionStart;
      setState({ fullSearchResults: results, fullSearchLoading: false }, false);
      if (wasFocused) requestAnimationFrame(() => {
        const input = document.querySelector("#bible-search");
        input?.focus();
        if (Number.isInteger(cursor)) input?.setSelectionRange(cursor, cursor);
      });
    }
  } catch (error) {
    if (state.searchQuery === expectedQuery) {
      setState({ fullSearchResults: [], fullSearchLoading: false }, false);
      showToast(text("No fue posible buscar en la Biblia completa", "Could not search the complete Bible"));
    }
  }
}

function previousOrNextVerse(direction) {
  const current = featuredVerses.findIndex((verse) => verse.id === state.selectedVerseId);
  const next = (current + direction + featuredVerses.length) % featuredVerses.length;
  openReader(featuredVerses[next].id);
}

function clearSelectionUI() {
  document.querySelectorAll(".word-token.selected").forEach((token) => token.classList.remove("selected"));
  document.querySelectorAll("[data-verse-key].has-selection").forEach((host) => host.classList.remove("has-selection"));
  document.querySelectorAll(".selection-preview").forEach((preview) => { preview.textContent = ""; });
  activeSelectionKey = null;
}

function updateSelectionUI(host) {
  const selected = [...host.querySelectorAll(".word-token.selected")];
  const preview = host.querySelector(".selection-preview");
  if (!selected.length) {
    host.classList.remove("has-selection");
    if (preview) preview.textContent = "";
    activeSelectionKey = null;
    return;
  }
  activeSelectionKey = host.dataset.verseKey;
  host.classList.add("has-selection");
  if (preview) preview.textContent = selected.map((token) => token.dataset.word).join(" ");
}

async function getParallelVerseRecord(record) {
  if (!record) return null;
  if (record.featuredId) {
    const verse = getVerse(record.featuredId);
    return featuredVerseRecord(verse, record.sourceLang === "en" ? "es" : "en");
  }
  if (!record.bookId || !record.chapter || !record.verse) return null;
  const targetVersionId = record.sourceLang === "en" ? "mi-biblia" : "kjv";
  const targetVersion = BIBLE_VERSIONS[targetVersionId];
  const targetChapter = await getBibleChapter(targetVersionId, record.bookId, record.chapter);
  const targetText = targetChapter[Number(record.verse)];
  const book = books.find((item) => item.id === record.bookId);
  if (!targetText || !book) return null;
  return {
    key: `bible:${targetVersionId}:${record.bookId}:${record.chapter}:${record.verse}`,
    text: targetText,
    reference: `${book[targetVersion.language]} ${record.chapter}:${record.verse}`,
    sourceLang: targetVersion.language,
    version: targetVersionId,
    bookId: record.bookId,
    chapter: Number(record.chapter),
    verse: Number(record.verse)
  };
}

function attachParallelPassage(help, parallel, selection, fragment) {
  if (!parallel) return help;
  return {
    ...help,
    phrase: selection,
    phraseEs: fragment,
    parallelText: fragment,
    parallelReference: parallel.reference
  };
}

async function getCanonicalSourceRecord(record) {
  if (!record) return null;
  if (record.featuredId) return featuredVerseRecord(getVerse(record.featuredId), record.sourceLang);
  if (!record.bookId || !record.chapter || !record.verse) return null;
  const versionId = record.version || (record.sourceLang === "es" ? "mi-biblia" : "kjv");
  const version = BIBLE_VERSIONS[versionId];
  if (!version) return null;
  const chapter = await getBibleChapter(versionId, record.bookId, record.chapter);
  const sourceText = chapter[Number(record.verse)];
  return sourceText ? { ...record, text: sourceText } : null;
}

function localLiteralHelp(selection, sourceLang) {
  const words = selectionWords(selection);
  const helps = sourceLang === "en" ? words.map((word) => getWordHelp(word)) : [];
  const known = helps.length === words.length && helps.every((help) => help.known);
  const translated = known ? helps.map((help) => help.es).join(" ") : "";
  return {
    known,
    es: translated,
    translated,
    pronunciation: text("Escuchar", "Listen"),
    type: text("significado literal", "literal meaning"),
    meaning: known
      ? text("Significado literal de la palabra o de las dos palabras seleccionadas.", "Literal meaning of the selected word or two-word selection.")
      : text("Preparando el significado literal en el dispositivo.", "Preparing the literal meaning on this device."),
    phrase: selection,
    phraseEs: translated || text("Traduciendo…", "Translating…")
  };
}

async function openContextTranslation(selection, context, sourceLang = "en", record = null, suppliedParallel = null, selectionRange = null) {
  const cleanSelection = selection.trim();
  const mode = translationMode(cleanSelection);
  if (mode === "empty") return;

  if (mode === "parallel-passage") {
    const loadingHelp = {
      translated: text("Abriendo la Biblia paralela…", "Opening the parallel Bible…"),
      pronunciation: text("Texto bíblico", "Bible text"),
      type: text("pasaje bíblico", "Bible passage"),
      meaning: text("Buscando el texto exacto en la Biblia del idioma contrario.", "Finding the exact text in the Bible of the opposite language."),
      phrase: context,
      phraseEs: ""
    };
    setState({ modal: { type: "translation", word: cleanSelection, sourceLang, help: loadingHelp } }, false);
    try {
      const [parallelResult, hintResult, sourceResult] = await Promise.allSettled([
        suppliedParallel?.text ? Promise.resolve(suppliedParallel) : getParallelVerseRecord(record),
        translateWithContext(cleanSelection, cleanSelection, sourceLang),
        suppliedParallel?.text ? Promise.resolve(null) : getCanonicalSourceRecord(record)
      ]);
      const parallel = parallelResult.status === "fulfilled" ? parallelResult.value : null;
      const hintHelp = hintResult.status === "fulfilled" ? hintResult.value : null;
      const canonicalSource = sourceResult.status === "fulfilled" ? sourceResult.value : null;
      if (parallel?.text) {
        const alignmentSource = canonicalSource?.text || context;
        const aligned = alignParallelFragment({
          selection: cleanSelection,
          sourceText: alignmentSource,
          targetText: parallel.text,
          hint: hintHelp?.translated || "",
          range: alignmentSource === context ? selectionRange : null
        });
        const fragment = aligned.text || parallel.text;
        setState({ modal: { type: "translation", word: cleanSelection, sourceLang, help: {
          ...attachParallelPassage(loadingHelp, parallel, cleanSelection, fragment),
          translated: fragment,
          pronunciation: text("Texto bíblico", "Bible text"),
          type: text("fragmento de la Biblia paralela", "parallel Bible fragment"),
          meaning: text("Solo se muestra el fragmento equivalente copiado de la Biblia integrada en el idioma contrario.", "Only the equivalent fragment copied from the integrated Bible in the opposite language is shown.")
        } } }, false);
        return;
      }
      if (hintHelp?.translated) {
        setState({ modal: { type: "translation", word: cleanSelection, sourceLang, help: {
          ...hintHelp,
          phrase: cleanSelection,
          phraseEs: hintHelp.translated,
          type: text("frase contextual", "contextual phrase"),
          meaning: text("Este texto no es un versículo paralelo; se tradujo únicamente la frase seleccionada.", "This text is not a parallel Bible verse; only the selected phrase was translated.")
        } } }, false);
        return;
      }
    } catch { /* use the on-device fallback below */ }

    try {
      const fallback = await translateWithContext(cleanSelection, cleanSelection, sourceLang);
      if (fallback) {
        setState({ modal: { type: "translation", word: cleanSelection, sourceLang, help: fallback } }, false);
      } else {
        setState({ modal: { type: "translation", word: cleanSelection, sourceLang, help: {
          ...loadingHelp,
          translated: text("Pasaje no disponible", "Passage unavailable"),
          meaning: text("No encontramos todavía el pasaje paralelo para este texto.", "The parallel passage for this text is not available yet.")
        } } }, false);
      }
    } catch {
      setState({ modal: { type: "translation", word: cleanSelection, sourceLang, help: {
        ...loadingHelp,
        translated: text("Pasaje no disponible", "Passage unavailable"),
        meaning: text("No encontramos todavía el pasaje paralelo para este texto.", "The parallel passage for this text is not available yet.")
      } } }, false);
    }
    return;
  }

  const localHelp = localLiteralHelp(cleanSelection, sourceLang);
  setState({ modal: { type: "translation", word: cleanSelection, sourceLang, help: localHelp } }, false);
  if (localHelp.known) return;
  try {
    // One or two words are intentionally translated without the full verse.
    // This avoids a second model request and preserves the requested literal meaning.
    const nativeHelp = await translateWithContext(cleanSelection, cleanSelection, sourceLang);
    if (nativeHelp) {
      setState({ modal: { type: "translation", word: cleanSelection, sourceLang, help: {
        ...nativeHelp,
        type: text("significado literal", "literal meaning"),
        meaning: text("Significado literal de la palabra o de las dos palabras seleccionadas.", "Literal meaning of the selected word or two-word selection.")
      } } }, false);
    }
  } catch {
    setState({ modal: { type: "translation", word: cleanSelection, sourceLang, help: {
      ...localHelp,
      translated: text("Modelo pendiente", "Model pending"),
      meaning: text("Conéctate una vez para descargar el diccionario inglés–español; después funcionará sin conexión.", "Connect once to download the English–Spanish dictionary; afterward it works offline.")
    } } }, false);
  }
}

async function openFullVerseTranslation(record) {
  if (!record) return;
  setState({ modal: { type: "translation-loading" } }, false);
  try {
    const target = await getParallelVerseRecord(record);
    if (!target) throw new Error("Parallel verse unavailable");
    setState({ modal: { type: "verse-translation", source: record, target } }, false);
  } catch {
    setState({ modal: null }, false);
    showToast(text("No pudimos abrir la traducción paralela", "We couldn't open the parallel translation"));
  }
}

function wrapCanvasText(context, value, maxWidth) {
  const words = value.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

async function createVerseShareFile(record) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 1080, 1080);
  gradient.addColorStop(0, "#173f37");
  gradient.addColorStop(.62, "#28594c");
  gradient.addColorStop(1, "#c59d65");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1080, 1080);
  context.globalAlpha = .12;
  context.fillStyle = "#fff6df";
  context.beginPath(); context.arc(930, 130, 260, 0, Math.PI * 2); context.fill();
  context.beginPath(); context.arc(120, 1000, 330, 0, Math.PI * 2); context.fill();
  context.globalAlpha = 1;
  context.fillStyle = "#f2cc83";
  context.font = "700 30px Arial";
  context.letterSpacing = "5px";
  context.fillText("DUOBIBLIA", 90, 105);
  context.fillStyle = "#fffdf5";
  context.font = "56px Georgia";
  const lines = wrapCanvasText(context, `“${record.text}”`, 880);
  const lineHeight = 78;
  const startY = Math.max(250, 520 - (lines.length * lineHeight) / 2);
  lines.slice(0, 8).forEach((line, index) => context.fillText(line, 90, startY + index * lineHeight));
  context.fillStyle = "#f2cc83";
  context.font = "700 34px Arial";
  context.fillText(record.reference, 90, 890);
  context.fillStyle = "rgba(255,255,255,.78)";
  context.font = "24px Arial";
  context.fillText("Lee · Aprende · Comparte", 90, 955);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", .94));
  return blob ? new File([blob], `DuoBiblia-${record.reference.replace(/[^a-z0-9]+/gi, "-")}.png`, { type: "image/png" }) : null;
}

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function shareVerse(record) {
  if (!record) return;
  const shareText = `“${record.text}”\n${record.reference}\n\nDuoBiblia`;
  try {
    const file = await createVerseShareFile(record);
    if (file && Capacitor.isNativePlatform()) {
      await NativeVerseShare.shareImage({
        title: record.reference,
        text: shareText,
        base64: await fileToBase64(file)
      });
      return;
    }
    if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: record.reference, text: shareText, files: [file] });
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: record.reference, text: shareText });
      return;
    }
    await navigator.clipboard.writeText(shareText);
    showToast(text("Versículo copiado para compartir", "Verse copied for sharing"));
  } catch (error) {
    if (error?.name !== "AbortError") showToast(text("No pudimos compartir el versículo", "We couldn't share the verse"));
  }
}

async function playPrayerTrack(track = chooseNextTrack(state.currentTrackId)) {
  if (prayerAudio) {
    prayerAudio.pause();
    prayerAudio.removeAttribute("src");
  }
  const audio = new Audio(track.src);
  audio.volume = 0.82;
  audio.preload = "auto";
  audio.addEventListener("ended", () => {
    if (state.musicEnabled && state.route === "prayer") playPrayerTrack();
  }, { once: true });
  prayerAudio = audio;
  state.currentTrackId = track.id;
  state.musicEnabled = true;
  persist();
  try {
    await audio.play();
    setState({ audioPlaying: true }, false);
  } catch {
    setState({ audioPlaying: false }, false);
    showToast(text("Toca el icono de música para comenzar", "Tap the music icon to begin"));
  }
}

async function startPrayerMusic() {
  state.musicEnabled = true;
  persist();
  if (prayerAudio?.src) {
    try {
      await prayerAudio.play();
      setState({ audioPlaying: true }, false);
      return;
    } catch { /* create a fresh player below */ }
  }
  await playPrayerTrack(chooseNextTrack(state.currentTrackId));
}

function pausePrayerMusic() {
  prayerAudio?.pause();
  setState({ musicEnabled: false, audioPlaying: false });
}

function stopPrayerMusic() {
  if (prayerAudio) {
    prayerAudio.pause();
    prayerAudio.removeAttribute("src");
  }
  prayerAudio = null;
  state.audioPlaying = false;
}

function suspendActiveMedia() {
  stopPrayerMusic();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

app.addEventListener("click", async (event) => {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;
  const action = actionTarget.dataset.action;

  if (action === "choose-language") {
    const uiLang = actionTarget.dataset.language;
    setState({ uiLang, bibleVersion: uiLang === "es" ? "mi-biblia" : "kjv", onboarded: true, phase: "mood" });
  } else if (action === "skip-mood") {
    setState({ moodDate: dateKey(), phase: "app", route: "home", notificationPromptSeen: true, modal: state.notificationPromptSeen ? null : { type: "notifications" } });
  } else if (action === "choose-mood") {
    setState({ moodDate: dateKey(), modal: { type: "mood-verse", moodId: actionTarget.dataset.mood } });
  } else if (action === "continue-home") {
    setState({ phase: "app", route: "home", notificationPromptSeen: true, modal: state.notificationPromptSeen ? null : { type: "notifications" } });
  } else if (action === "read-mood-verse") {
    state.phase = "app";
    openReader(actionTarget.dataset.verse);
  } else if (action === "nav") {
    navigate(actionTarget.dataset.route);
  } else if (action === "back") {
    if (state.route === "chapter" && state.activePlanDay) {
      setState({ route: "reading-plan", activePlanDay: null, modal: null });
      window.scrollTo({ top: 0, behavior: "instant" });
    } else {
      navigate(["reader", "chapter", "reading-plan"].includes(state.route) ? "bible" : "home");
    }
  } else if (action === "open-reader") {
    openReader(actionTarget.dataset.verse);
  } else if (action === "read-collection-item") {
    const record = resolveVerseRecord(actionTarget.dataset.verseKey);
    setState({ modal: null }, false);
    if (record?.featuredId) openReader(record.featuredId);
    else if (record) await openBibleChapter(record.bookId, record.chapter, record.verse, record.version);
    else showToast(text("No pudimos volver a abrir este versículo", "We couldn't reopen this verse"));
  } else if (action === "open-prayer") {
    navigate("prayer");
    if (state.musicEnabled) await startPrayerMusic();
  } else if (action === "open-devotional") {
    setState({ route: "devotional", devotionalDay: devotionalIndexForDate(), modal: null });
    window.scrollTo({ top: 0, behavior: "instant" });
    await loadYouthDevotionalContent();
  } else if (action === "retry-devotional") {
    await loadYouthDevotionalContent();
  } else if (action === "devotional-previous" || action === "devotional-next") {
    const delta = action === "devotional-next" ? 1 : -1;
    setState({ devotionalDay: (state.devotionalDay + delta + DEVOTIONAL_DAYS) % DEVOTIONAL_DAYS });
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (action === "devotional-today") {
    setState({ devotionalDay: devotionalIndexForDate() });
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (action === "complete-devotional") {
    const devotional = getYouthDevotionalPreview(state.devotionalDay);
    const alreadyCompleted = state.completedDevotionalDays.includes(devotional.id);
    const completedDevotionalDays = [...new Set([...state.completedDevotionalDays, devotional.id])];
    setState({ completedDevotionalDays, points: alreadyCompleted ? state.points : state.points + 15 });
    if (!alreadyCompleted) {
      showToast(text("Matutina completada · +15 XP", "Devotional completed · +15 XP"));
      await showAchievementInterstitial({ premium: state.premium });
    }
  } else if (action === "open-topics") {
    navigate("topics");
  } else if (action === "select-topic") {
    setState({ selectedTopic: actionTarget.dataset.topic, route: state.route === "topics" ? "topics" : "topics" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (action === "open-reading-plan") {
    openReadingPlan();
  } else if (action === "open-book") {
    await openBibleChapter(actionTarget.dataset.bookId, 1);
  } else if (action === "open-bible-verse") {
    await openBibleChapter(actionTarget.dataset.bookId, actionTarget.dataset.chapter, actionTarget.dataset.verseNumber, actionTarget.dataset.version);
  } else if (action === "previous-chapter" || action === "next-chapter") {
    await openBibleChapter(state.selectedBookId, state.selectedChapter + (action === "next-chapter" ? 1 : -1));
  } else if (action === "plan-previous-reading" || action === "plan-next-reading") {
    const index = findReadingPlanChapter(state.activePlanDay, state.selectedBookId, state.selectedChapter);
    await openPlanChapterAt(index + (action === "plan-next-reading" ? 1 : -1));
  } else if (action === "return-reading-plan") {
    setState({ route: "reading-plan", activePlanDay: null, modal: null });
    window.scrollTo({ top: 0, behavior: "instant" });
  } else if (action === "switch-bible-version") {
    const version = actionTarget.dataset.version;
    if (state.route === "chapter") await openBibleChapter(state.selectedBookId, state.selectedChapter, state.selectedKjvVerse, version);
    else {
      setState({ bibleVersion: version, fullSearchResults: null });
      if (state.searchQuery) runFullBibleSearch(state.searchQuery);
    }
  } else if (action === "select-word") {
    const host = actionTarget.closest("[data-verse-key]");
    if (!host) return;
    if (activeSelectionKey && activeSelectionKey !== host.dataset.verseKey) clearSelectionUI();
    actionTarget.classList.toggle("selected");
    updateSelectionUI(host);
  } else if (action === "translate-selection") {
    const host = actionTarget.closest("[data-verse-key]");
    if (!host) return;
    const selectedTokens = [...host.querySelectorAll(".word-token.selected")];
    const selection = selectedTokens.map((token) => token.dataset.word).join(" ");
    const selectedIndexes = selectedTokens.map((token) => Number(token.dataset.tokenIndex)).filter(Number.isInteger);
    const selectionRange = selectedIndexes.length
      ? { startIndex: Math.min(...selectedIndexes), endIndex: Math.max(...selectedIndexes) }
      : null;
    const suppliedParallel = host.dataset.parallelText
      ? { text: host.dataset.parallelText, reference: host.dataset.parallelReference || text("Texto paralelo", "Parallel text") }
      : null;
    await openContextTranslation(selection, host.dataset.verseContext || host.dataset.verseText || selection, host.dataset.sourceLang || "en", recordFromElement(host), suppliedParallel, selectionRange);
  } else if (action === "clear-selection") {
    clearSelectionUI();
  } else if (action === "translate-word") {
    const word = actionTarget.dataset.word;
    const host = actionTarget.closest("[data-verse-key], [data-verse-context]");
    const suppliedParallel = host?.dataset.parallelText
      ? { text: host.dataset.parallelText, reference: host.dataset.parallelReference || text("Texto paralelo", "Parallel text") }
      : null;
    const tokenIndex = Number(actionTarget.dataset.tokenIndex);
    await openContextTranslation(word, host?.dataset.verseContext || word, host?.dataset.sourceLang || "en", recordFromElement(host), suppliedParallel, Number.isInteger(tokenIndex) ? { startIndex: tokenIndex, endIndex: tokenIndex } : null);
  } else if (action === "translate-phrase") {
    const word = actionTarget.dataset.phrase;
    const sourceLang = actionTarget.closest("[data-source-lang]")?.dataset.sourceLang || (state.bibleVersion === "mi-biblia" ? "es" : "en");
    setState({ modal: { type: "translation", word, sourceLang, help: { translated: actionTarget.dataset.translation, pronunciation: text("frase", "phrase"), type: text("expresión", "phrase"), meaning: text("La frase completa conserva un sentido más natural que la suma de palabras aisladas.", "The complete phrase preserves a more natural meaning than isolated words."), phrase: word, phraseEs: actionTarget.dataset.translation } } }, false);
  } else if (action === "translate-verse") {
    await openFullVerseTranslation(recordFromElement(actionTarget));
  } else if (action === "open-verse-tools") {
    const record = recordFromElement(actionTarget);
    setState(withStoredRecord(record, { modal: { type: "verse-tools", record } }), true);
  } else if (action === "close-modal" || action === "close-on-backdrop") {
    if (action === "close-on-backdrop" && !event.target.classList.contains("modal-layer")) return;
    setState({ modal: null, pendingPremium: false, pendingStreakReward: false, authError: null });
  } else if (action === "toggle-favorite") {
    const record = recordFromElement(actionTarget);
    if (!record) return;
    const exists = state.favorites.includes(record.key);
    const favorites = exists ? state.favorites.filter((item) => item !== record.key) : [...state.favorites, record.key];
    setState(withStoredRecord(record, { favorites }));
    showToast(exists ? text("Eliminado de favoritos", "Removed from favorites") : text("Guardado en favoritos", "Saved to favorites"));
  } else if (action === "open-note") {
    const record = recordFromElement(actionTarget);
    if (!record) return;
    setState(withStoredRecord(record, { modal: { type: "note", record } }), true);
  } else if (action === "save-note") {
    event.preventDefault();
    const value = document.querySelector("#note-text")?.value.trim();
    const record = recordFromElement(actionTarget);
    if (!record) return;
    const notes = { ...state.notes };
    if (value) notes[record.key] = value; else delete notes[record.key];
    setState(withStoredRecord(record, { notes, modal: null }));
    showToast(text("Nota guardada", "Note saved"));
  } else if (action === "open-highlight") {
    const record = recordFromElement(actionTarget);
    if (!record) return;
    setState(withStoredRecord(record, { modal: { type: "highlight", record } }), true);
  } else if (action === "set-highlight") {
    const record = recordFromElement(actionTarget);
    if (!record) return;
    const highlights = { ...state.highlights };
    if (actionTarget.dataset.color === "none") delete highlights[record.key];
    else highlights[record.key] = actionTarget.dataset.color;
    setState(withStoredRecord(record, { highlights, modal: { type: "verse-tools", record } }));
    showToast(text("Color del versículo actualizado", "Verse color updated"));
  } else if (action === "share-verse") {
    await shareVerse(recordFromElement(actionTarget));
  } else if (action === "toggle-audio") {
    state.audioPlaying ? pausePrayerMusic() : await startPrayerMusic();
  } else if (action === "next-track") {
    await playPrayerTrack();
  } else if (action === "amen") {
    const prayer = getPrayerExperience();
    const result = completePrayer(state, new Date(), prayer.period);
    if (!result.newlyCompleted) return showToast(text("Este momento de oración ya está completo", "This prayer moment is already complete"));
    setState({ streak: result.streak, points: result.points, lastPrayerDate: result.lastPrayerDate, lastPrayerCompletedAt: result.lastPrayerCompletedAt, prayerCompletions: result.prayerCompletions, modal: null });
    await showAchievementInterstitial({ premium: state.premium });
    setState({ modal: { type: "streak" } }, false);
  } else if (action === "close-streak") {
    stopPrayerMusic();
    setState({ route: "home", modal: null, audioPlaying: false });
    window.scrollTo({ top: 0, behavior: "instant" });
  } else if (action === "claim-streak-reward") {
    if (!state.authUser) {
      setState({ modal: { type: "account" }, pendingStreakReward: true, authError: null });
      return;
    }
    try {
      await syncProgress(state.authUser, progressForSync());
      const entitlement = await claimStreakReward(state.authUser);
      setState({ premium: entitlement.premium, premiumUntil: entitlement.premiumUntil, modal: { type: "premium" }, pendingStreakReward: false });
      showToast(text("Tu mes Premium gratis está activo", "Your free Premium month is active"));
    } catch (error) {
      showToast(error.message);
    }
  } else if (action === "quiz-answer") {
    const type = actionTarget.dataset.quizType;
    const selectedIndex = Number(actionTarget.dataset.optionIndex);
    if (!["language", "bible"].includes(type) || Number.isInteger(state.dailyQuizAnswers?.[type])) return;
    const quiz = getDailyQuizSet()[type];
    const correct = selectedIndex === quiz.correctIndex;
    const answers = { ...(state.dailyQuizAnswers || {}), [type]: selectedIndex };
    const completed = { ...(state.dailyQuizCompleted || {}), [type]: true };
    const allDone = Number.isInteger(answers.language) && Number.isInteger(answers.bible);
    const stats = {
      answered: Number(state.quizStats?.answered || 0) + 1,
      correct: Number(state.quizStats?.correct || 0) + (correct ? 1 : 0),
      wordsLearned: Number(state.quizStats?.wordsLearned || 0) + (correct && type === "language" ? 1 : 0)
    };
    setState({
      dailyQuizDate: dateKey(),
      dailyQuizAnswers: answers,
      dailyQuizCompleted: completed,
      quizStats: stats,
      quizAnswer: selectedIndex,
      quizCompleted: allDone,
      lastQuizDate: allDone ? dateKey() : state.lastQuizDate,
      points: correct ? state.points + 20 : state.points
    });
    if (allDone && state.lastQuizAdDate !== dateKey()) {
      setState({ lastQuizAdDate: dateKey() });
      await showAchievementInterstitial({ premium: state.premium });
      showToast(text("Dos retos diarios completados", "Two daily challenges completed"));
    }
  } else if (action === "toggle-theme") {
    setState({ dark: !state.dark });
  } else if (action === "toggle-notifications") {
    if (state.notificationsEnabled) {
      try {
        await disablePrayerNotifications();
        setState({ notificationsEnabled: false, notificationPromptSeen: true });
        showToast(text("Recordatorios desactivados", "Reminders disabled"));
      } catch {
        showToast(text("No pudimos cambiar los recordatorios", "We couldn't change the reminders"));
      }
    } else {
      setState({ modal: { type: "notifications" }, notificationPromptSeen: true }, false);
    }
  } else if (action === "enable-notifications") {
    try {
      const result = await enablePrayerNotifications(state.uiLang);
      if (!result.enabled) {
        showToast(result.reason === "unsupported"
          ? text("Los recordatorios estarán disponibles en el APK", "Reminders will be available in the APK")
          : text("Permiso denegado. Puedes activarlo en Ajustes del celular.", "Permission denied. You can enable it in phone Settings."));
        setState({ notificationsEnabled: false, notificationPromptSeen: true, modal: null });
        return;
      }
      setState({ notificationsEnabled: true, notificationPromptSeen: true, modal: null });
      showToast(text("Tres recordatorios diarios activados", "Three daily reminders enabled"));
    } catch {
      showToast(text("No pudimos programar los recordatorios", "We couldn't schedule the reminders"));
    }
  } else if (action === "switch-language") {
    const uiLang = opposite();
    setState({ uiLang, bibleVersion: uiLang === "es" ? "mi-biblia" : "kjv", fullSearchResults: null });
    if (state.notificationsEnabled) enablePrayerNotifications(uiLang).catch(() => {});
  } else if (action === "open-account") {
    setState({ modal: { type: "account" }, pendingPremium: false, pendingStreakReward: false, authError: null }, false);
  } else if (action === "send-email-code") {
    event.preventDefault();
    const form = document.querySelector("#account-form");
    if (!form?.reportValidity()) return;
    const email = document.querySelector("#account-email").value.trim().toLowerCase();
    setState({ authLoading: true, authError: null, authEmail: email }, false);
    try {
      await sendEmailCode(email);
      setState({ authLoading: false, modal: { type: "email-code" } }, false);
    } catch (error) {
      setState({ authLoading: false, authError: error.message }, false);
    }
  } else if (action === "resend-email-code") {
    setState({ authLoading: true, authError: null }, false);
    try {
      await sendEmailCode(state.authEmail);
      setState({ authLoading: false }, false);
      showToast(text("Código reenviado", "Code resent"));
    } catch (error) {
      setState({ authLoading: false, authError: error.message }, false);
    }
  } else if (action === "verify-email-code") {
    event.preventDefault();
    const form = document.querySelector("#otp-form");
    if (!form?.reportValidity()) return;
    const code = document.querySelector("#account-code").value.trim();
    setState({ authLoading: true, authError: null }, false);
    try {
      const session = await verifyEmailCode(state.authEmail, code);
      if (session) await handleAuthSession(session);
    } catch (error) {
      setState({ authLoading: false, authError: error.message }, false);
    }
  } else if (action === "google-auth") {
    setState({ authLoading: true, authError: null }, false);
    try {
      await signInWithGoogle();
      if (!state.authUser) setState({ authLoading: false }, false);
    } catch (error) {
      setState({ authLoading: false, authError: error.message }, false);
    }
  } else if (action === "open-premium") {
    setState(state.authUser
      ? { modal: { type: "premium" }, authError: null }
      : { modal: { type: "account" }, pendingPremium: true, authError: null }, false);
  } else if (action === "activate-premium") {
    if (!state.authUser) {
      setState({ modal: { type: "account" }, pendingPremium: true }, false);
      return;
    }
    try {
      await openBoldCheckout();
      setState({ modal: { type: "payment-pending" } }, false);
    } catch (error) {
      showToast(error.message === "EXTERNAL_BILLING_DISABLED"
        ? text("El pago externo no está habilitado en esta edición", "External billing is not enabled in this edition")
        : text("No se pudo abrir Bold", "Bold could not be opened"));
    }
  } else if (action === "verify-premium") {
    if (!state.authUser) {
      setState({ modal: { type: "account" }, pendingPremium: true }, false);
      return;
    }
    try {
      const entitlement = await getEntitlement(state.authUser);
      if (!entitlement.premium) {
        showToast(text("El pago aún no aparece aprobado. Intenta de nuevo en unos segundos.", "The payment is not approved yet. Try again in a few seconds."));
        return;
      }
      setState({ premium: true, premiumUntil: entitlement.premiumUntil, modal: null });
      showToast(text("Premium activado", "Premium activated"));
    } catch {
      showToast(text("No pudimos verificar el pago", "We couldn't verify the payment"));
    }
  } else if (action === "sign-out") {
    try {
      await signOut();
      setState({ authUser: null, account: null, premium: false, premiumUntil: null }, true);
      showToast(text("Sesión cerrada", "Signed out"));
    } catch (error) {
      showToast(error.message);
    }
  } else if (action === "ad-privacy-options") {
    const shown = await showAdPrivacyOptions();
    if (!shown) showToast(dualText("Las opciones se mostrarán cuando AdMob las requiera en el APK.", "Options will appear in the APK when AdMob requires them."));
  } else if (action === "open-delete-account") {
    setState({ modal: { type: "delete-account" }, authError: null }, false);
  } else if (action === "open-privacy-policy") {
    await openPrivacyPolicy();
  } else if (action === "open-account-deletion-page") {
    await openAccountDeletionPage();
  } else if (action === "confirm-delete-account") {
    setState({ authLoading: true, authError: null }, false);
    try {
      await deleteAccount();
      const preservedPreferences = {
        phase: "app", onboarded: true, uiLang: state.uiLang, bibleVersion: state.bibleVersion,
        dark: state.dark, notificationPromptSeen: state.notificationPromptSeen,
        notificationsEnabled: state.notificationsEnabled
      };
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_BACKUP_KEY);
      state = { ...initialState, ...preservedPreferences, route: "profile", modal: null };
      persist();
      render();
      showToast(dualText("Cuenta y datos eliminados", "Account and data deleted"));
    } catch (error) {
      setState({ authLoading: false, authError: error.message || dualText("No pudimos eliminar la cuenta", "We couldn't delete the account") }, false);
    }
  } else if (action === "open-update") {
    await openRequiredUpdate(state.updateRequired);
  } else if (action === "show-favorites" || action === "show-notes") {
    setState({ modal: { type: "collection", collection: action === "show-favorites" ? "favorites" : "notes" } }, false);
  } else if (action === "previous-verse") {
    previousOrNextVerse(-1);
  } else if (action === "next-verse") {
    previousOrNextVerse(1);
  } else if (action === "speak-word") {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(actionTarget.dataset.word);
      utterance.lang = actionTarget.dataset.language === "es" ? "es-ES" : "en-US";
      utterance.rate = 0.78;
      speechSynthesis.speak(utterance);
    }
  } else if (action === "plan-day") {
    await openPlanDay(Number(actionTarget.dataset.day));
  } else if (action === "plan-week") {
    const readingPlanWeek = Math.max(1, Math.min(53, state.readingPlanWeek + Number(actionTarget.dataset.delta || 0)));
    setState({ readingPlanWeek });
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (action === "complete-plan-day") {
    const planDay = getReadingPlanDay(state.activePlanDay);
    if (!planDay) return;
    const alreadyCompleted = state.completedPlanDays.includes(planDay.day);
    const completedPlanDays = [...new Set([...state.completedPlanDays, planDay.day])].sort((a, b) => a - b);
    setState({
      completedPlanDays,
      readChapters: completedPlanDays.length,
      points: alreadyCompleted ? state.points : state.points + 25,
      readingPlanWeek: planDay.week,
      activePlanDay: null,
      route: "reading-plan",
      modal: null
    });
    showToast(text(`Día ${planDay.day} completado · +25 XP`, `Day ${planDay.day} complete · +25 XP`));
    window.scrollTo({ top: 0, behavior: "instant" });
  }
});

app.addEventListener("input", (event) => {
  if (event.target.id === "note-text") {
    const record = recordFromElement(event.target);
    if (!record) return;
    const notes = { ...state.notes };
    const value = event.target.value;
    if (value.trim()) notes[record.key] = value;
    else delete notes[record.key];
    setState(withStoredRecord(record, { notes }), true, false);
    const status = document.querySelector("#note-autosave-status");
    if (status) status.innerHTML = dualText("Guardado ahora", "Saved now");
    return;
  }
  if (event.target.id !== "bible-search") return;
  const value = event.target.value;
  state.searchQuery = value;
  state.fullSearchResults = null;
  persist();
  clearTimeout(bibleSearchTimer);
  if (!value.trim()) {
    state.fullSearchLoading = false;
    render();
    requestAnimationFrame(() => document.querySelector("#bible-search")?.focus());
    return;
  }
  bibleSearchTimer = setTimeout(() => runFullBibleSearch(value), 220);
});

app.addEventListener("change", (event) => {
  if (event.target.id !== "devotional-picker") return;
  const devotionalDay = Number(event.target.value);
  if (!Number.isInteger(devotionalDay)) return;
  setState({ devotionalDay: Math.max(0, Math.min(DEVOTIONAL_DAYS - 1, devotionalDay)) });
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (state.phase !== "app") return;
    if (state.route !== "bible") navigate("bible");
    setTimeout(() => document.querySelector("#bible-search")?.focus(), 0);
  }
  if (event.key === "Escape" && state.modal) setState({ modal: null }, false);
});

MobileApp.addListener("appStateChange", ({ isActive }) => {
  if (!isActive) {
    suspendActiveMedia();
    persist();
    flushProgressSync();
    return;
  }
  if (state.dailyQuizDate !== dateKey()) {
    setState({ dailyQuizDate: dateKey(), dailyQuizAnswers: { language: null, bible: null }, dailyQuizCompleted: { language: false, bible: false }, quizCompleted: false, quizAnswer: null });
  } else if (["prayer", "home", "learn", "devotional"].includes(state.route)) render();
  ensurePrayerNotificationSchedule();
}).catch(() => {});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    suspendActiveMedia();
    persist();
    flushProgressSync();
  }
});
window.addEventListener("pagehide", () => {
  suspendActiveMedia();
  persist();
  flushProgressSync();
});

render();
syncNativePremiumState(state.premium).catch(() => {});
initializePrayerNotifications(async () => {
  prayerOpenedFromNotification = true;
  setState({ phase: "app", route: "prayer", modal: null }, false);
  if (state.musicEnabled) await startPrayerMusic();
}).catch(() => {});
ensurePrayerNotificationSchedule();
initializeAuth(handleAuthSession).catch((error) => {
  setState({ authLoading: false, authError: error.message }, false);
});
getAuthCapabilities().then((capabilities) => {
  setState({ googleAuthEnabled: capabilities.google, emailAuthEnabled: capabilities.email, cloudProfilesEnabled: capabilities.profiles }, false);
});
checkRequiredUpdate().then((updateRequired) => {
  if (updateRequired) setState({ updateRequired }, false);
});
initializeMobileAds({ premium: state.premium });
setTimeout(() => {
  if (prayerOpenedFromNotification) return;
  const moodSeenToday = state.moodDate === dateKey();
  state.phase = !state.onboarded ? "onboarding" : (moodSeenToday ? "app" : "mood");
  if (state.phase === "app" && state.route === "chapter") openBibleChapter(state.selectedBookId, state.selectedChapter, state.selectedKjvVerse, state.bibleVersion);
  else render();
  if (state.phase === "app" && state.route === "devotional") loadYouthDevotionalContent();
}, 900);

if (import.meta.env.PROD && "serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
