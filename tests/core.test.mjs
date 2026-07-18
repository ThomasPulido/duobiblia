import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { books, completeDailyPrayer, completePrayer, dateKey, featuredVerses, getDailyVerse, getLocalDayPeriod, getMoodVerse, getWordHelp, hasCompletedDailyPrayer, hasCompletedPrayer, migratePrayerCompletions, normalizeWord, prayerDayKey, progressPercent, searchFeatured, wordDictionary } from "../src/core.mjs";
import { ANNUAL_DEVOTIONALS, getAnnualDevotional } from "../src/daily-content.mjs";
import { ANNUAL_BIBLE_QUIZZES, ANNUAL_LANGUAGE_QUIZZES, ANNUAL_QUIZ_SETS, getDailyQuizSet } from "../src/annual-quizzes.mjs";
import { chooseNextTrack, prayerTracks } from "../src/music.mjs";
import { mergeProgress } from "../src/account-core.mjs";
import { compareVersions } from "../src/update-service.mjs";
import { APP_VERSION } from "../src/update-service.mjs";
import { BOLD_CHECKOUT_URL } from "../src/billing-service.mjs";
import { ADMOB_IDS } from "../src/config.mjs";
import { prayerNotificationSchedule } from "../src/notification-service.mjs";
import { searchBible } from "../src/bible-service.mjs";
import { getCompletedBookProgress, getReadingPlanDay, getReadingPlanWeek, READING_PLAN_DAYS, YEAR_READING_PLAN } from "../src/reading-plan.mjs";
import { alignParallelFragment, selectionWords, translationMode } from "../src/translation-policy.mjs";
import { DEVOTIONAL_DAYS, DEVOTIONAL_SUGGESTED_PRAYERS, devotionalIndexForDate, getDailyYouthDevotional, getYouthDevotional } from "../src/devotional-year.mjs";

test("completar la oración inicia una racha y entrega puntos", () => {
  const result = completeDailyPrayer({ streak: 0, points: 0, lastPrayerDate: null }, new Date(2026, 6, 13, 9));
  assert.equal(result.streak, 1);
  assert.equal(result.points, 50);
  assert.equal(result.newlyCompleted, true);
});

test("completar dos veces el mismo día no duplica la recompensa", () => {
  const first = completePrayer({ streak: 8, points: 450, lastPrayerDate: "2026-07-12", prayerCompletions: {} }, new Date(2026, 6, 13, 8), "morning");
  const duplicate = completePrayer(first, new Date(2026, 6, 13, 10), "morning");
  assert.equal(duplicate.streak, 9);
  assert.equal(duplicate.points, 500);
  assert.equal(duplicate.newlyCompleted, false);
});

test("mañana y noche son rituales distintos pero la racha sube una sola vez", () => {
  const morning = completePrayer({ streak: 8, points: 450, lastPrayerDate: "2026-07-12", prayerCompletions: {} }, new Date(2026, 6, 13, 8), "morning");
  const night = completePrayer(morning, new Date(2026, 6, 13, 22), "night");
  assert.equal(night.newlyCompleted, true);
  assert.equal(night.streak, 9);
  assert.equal(night.points, 550);
  assert.equal(hasCompletedPrayer(night, new Date(2026, 6, 13, 22), "night"), true);
});

test("una fecha heredada de la nube no bloquea una oración nueva", () => {
  const legacyCloud = { streak: 9, points: 500, lastPrayerDate: "2026-07-15", lastPrayerCompletedAt: "2026-07-15T01:00:00.000Z" };
  assert.equal(hasCompletedPrayer(legacyCloud, new Date(2026, 6, 15, 22), "night"), false);
});

test("un día consecutivo aumenta la racha", () => {
  const result = completeDailyPrayer({ streak: 8, points: 450, lastPrayerDate: "2026-07-12" }, new Date(2026, 6, 13, 8));
  assert.equal(result.streak, 9);
});

test("Amén vuelve a habilitarse después de medianoche local", () => {
  const yesterdayNight = new Date(2026, 6, 14, 23, 58);
  const todayMorning = new Date(2026, 6, 15, 7, 0);
  const previous = completeDailyPrayer({ streak: 8, points: 450, lastPrayerDate: "2026-07-13" }, yesterdayNight);
  assert.equal(hasCompletedDailyPrayer(previous, yesterdayNight), true);
  assert.equal(hasCompletedDailyPrayer(previous, todayMorning), false);
  const today = completeDailyPrayer(previous, todayMorning);
  assert.equal(today.newlyCompleted, true);
  assert.equal(today.streak, 10);
  assert.equal(today.lastPrayerDate, "2026-07-15");
});

test("una oración hecha después de medianoche pertenece a la noche anterior", () => {
  const afterMidnight = new Date(2026, 6, 16, 0, 30);
  const followingNight = new Date(2026, 6, 16, 21, 30);
  const completed = completePrayer({ streak: 9, points: 500, lastPrayerDate: "2026-07-14", prayerCompletions: {} }, afterMidnight, "night");
  assert.equal(prayerDayKey(afterMidnight), "2026-07-15");
  assert.equal(completed.lastPrayerDate, "2026-07-15");
  assert.equal(hasCompletedPrayer(completed, followingNight, "night"), false);
  const next = completePrayer(completed, followingNight, "night");
  assert.equal(next.newlyCompleted, true);
  assert.equal(next.streak, 11);
});

test("la migración corrige una noche antigua guardada después de medianoche", () => {
  const completedAt = new Date(2026, 6, 16, 0, 30).toISOString();
  const migrated = migratePrayerCompletions({ "2026-07-16:night": completedAt });
  assert.deepEqual(migrated, { "2026-07-15:night": completedAt });
});

test("las ayudas de palabras ignoran puntuación", () => {
  assert.equal(getWordHelp("Peace,").es, "paz");
});

test("I y todas las palabras visibles tienen traducción local", () => {
  assert.equal(getWordHelp("I").es, "yo");
  for (const verse of featuredVerses) {
    for (const token of verse.en.split(/\s+/)) {
      const word = normalizeWord(token);
      if (word) assert.ok(wordDictionary[word], `Falta traducción para: ${word}`);
    }
  }
});

test("una o dos palabras usan significado literal y las frases usan la Biblia paralela", () => {
  assert.deepEqual(selectionWords("  by   grace "), ["by", "grace"]);
  assert.equal(translationMode("grace"), "literal");
  assert.equal(translationMode("by grace"), "literal");
  assert.equal(translationMode("saved by his grace"), "parallel-passage");
});

test("una frase devuelve solo su fragmento exacto de la Biblia paralela", () => {
  const sourceText = "The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit.";
  const targetText = "Cercano está Jehová a los quebrantados de corazón; Y salvará a los contritos de espíritu.";
  assert.equal(alignParallelFragment({ selection: "The LORD is", sourceText, targetText, hint: "El Señor está" }).text, "Cercano está Jehová");
  assert.equal(alignParallelFragment({ selection: "of a broken heart", sourceText, targetText, hint: "de corazón quebrantado" }).text, "quebrantados de corazón;");
  assert.notEqual(alignParallelFragment({ selection: "The LORD is", sourceText, targetText, hint: "El Señor está" }).text, targetText);
  assert.equal(alignParallelFragment({
    selection: "Dad gracias en todo",
    sourceText: "Dad gracias en todo; porque esta es la voluntad de Dios para con vosotros en Cristo Jesús.",
    targetText: "In every thing give thanks: for this is the will of God in Christ Jesus concerning you."
  }).text, "In every thing give thanks:");
});

test("la matutina anual contiene 365 días completos y navegables", () => {
  assert.equal(DEVOTIONAL_DAYS, 365);
  assert.equal(DEVOTIONAL_SUGGESTED_PRAYERS, 92);
  const januaryFirst = getYouthDevotional(0);
  const decemberLast = getYouthDevotional(364);
  assert.equal(januaryFirst.id, "01-01");
  assert.equal(decemberLast.id, "12-31");
  assert.ok(januaryFirst.body.length > 0);
  assert.ok(januaryFirst.verseQuote && januaryFirst.reflection && januaryFirst.challenge && januaryFirst.prayer);
  assert.equal(getDailyYouthDevotional(new Date(2026, 6, 17)).id, "07-17");
  assert.equal(devotionalIndexForDate(new Date(2028, 1, 29)), 58);
});

test("el estado de ánimo selecciona un versículo contextual", () => {
  assert.equal(getMoodVerse("tired").id, "matthew-11-28");
});

test("el progreso a Premium queda limitado a cien", () => {
  assert.equal(progressPercent(45), 50);
  assert.equal(progressPercent(100), 100);
});

test("la búsqueda encuentra referencias y temas", () => {
  assert.equal(searchFeatured("Filipenses", "es")[0].id, "philippians-4-6");
  assert.ok(searchFeatured("paz", "es").length >= 1);
});

test("la búsqueda completa encuentra libros sin tildes y los abre como libros", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path) => {
    const file = String(path).includes("mi-biblia") ? "mi-biblia.json" : "kjv.json";
    const payload = JSON.parse(await readFile(new URL(`../static/data/${file}`, import.meta.url), "utf8"));
    return { ok: true, json: async () => payload };
  };
  try {
    const [result] = await searchBible("mi-biblia", "genesis");
    assert.equal(result.type, "book");
    assert.equal(result.bookId, "GEN");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("dateKey usa fecha local estable", () => {
  assert.equal(dateKey(new Date(2026, 0, 2, 3)), "2026-01-02");
});

test("el versículo del día rota automáticamente y es estable durante el día", () => {
  const morning = getDailyVerse(new Date(2026, 6, 13, 7));
  const night = getDailyVerse(new Date(2026, 6, 13, 23));
  const tomorrow = getDailyVerse(new Date(2026, 6, 14, 7));
  assert.equal(morning.id, night.id);
  assert.notEqual(morning.id, tomorrow.id);
});

test("la oración se adapta a la hora local del dispositivo", () => {
  assert.equal(getLocalDayPeriod(new Date(2026, 6, 13, 8)), "morning");
  assert.equal(getLocalDayPeriod(new Date(2026, 6, 13, 15)), "afternoon");
  assert.equal(getLocalDayPeriod(new Date(2026, 6, 13, 22)), "night");
  assert.equal(getLocalDayPeriod(new Date(2026, 6, 13, 3)), "night");
});

test("hay contenido automático distinto para los 365 días y tres momentos diarios", () => {
  assert.equal(ANNUAL_DEVOTIONALS.length, 365);
  for (const period of ["morning", "afternoon", "night"]) {
    assert.equal(new Set(ANNUAL_DEVOTIONALS.map((day) => day[period].id)).size, 365);
    assert.equal(new Set(ANNUAL_DEVOTIONALS.map((day) => day[period].prayer.es)).size, 365);
  }
  assert.equal(getAnnualDevotional(new Date(2026, 6, 15, 8)).period, "morning");
  assert.equal(getAnnualDevotional(new Date(2026, 6, 15, 22)).period, "night");
});

test("cada día del año tiene un quiz de idioma y otro de la Biblia", () => {
  assert.equal(ANNUAL_LANGUAGE_QUIZZES.length, 365);
  assert.equal(ANNUAL_BIBLE_QUIZZES.length, 365);
  assert.equal(ANNUAL_QUIZ_SETS.length, 365);
  for (const set of ANNUAL_QUIZ_SETS) {
    assert.equal(set.language.category, "language");
    assert.equal(set.bible.category, "bible");
    for (const quiz of [set.language, set.bible]) {
      assert.ok(quiz.options.length >= 3);
      assert.ok(quiz.correctIndex >= 0 && quiz.correctIndex < quiz.options.length);
    }
  }
  const today = getDailyQuizSet(new Date(2026, 6, 15));
  const tomorrow = getDailyQuizSet(new Date(2026, 6, 16));
  assert.notEqual(today.language.id, tomorrow.language.id);
  assert.notEqual(today.bible.id, tomorrow.bible.id);
});

test("la música aleatoria evita repetir inmediatamente", () => {
  assert.equal(prayerTracks.length, 4);
  assert.notEqual(chooseNextTrack("como-agradecer", () => 0).id, "como-agradecer");
});

test("la KJV integrada contiene el canon completo y 31.102 versículos", async () => {
  const bible = JSON.parse(await readFile(new URL("../static/data/kjv.json", import.meta.url), "utf8"));
  assert.equal(books.length, 66);
  assert.equal(Object.keys(bible.books).length, 66);
  assert.equal(bible.meta.verseCount, 31102);
  assert.equal(
    bible.books.JOH.chapters[3][16],
    "¶ For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life."
  );
});

test("Mi Biblia integrada proviene exactamente del PDF entregado", async () => {
  const bible = JSON.parse(await readFile(new URL("../static/data/mi-biblia.json", import.meta.url), "utf8"));
  assert.equal(Object.keys(bible.books).length, 66);
  assert.equal(bible.meta.verseCount, 31102);
  assert.equal(bible.meta.source, "Mi Biblia traducida.pdf");
  assert.equal(bible.meta.sourceSha256, "c52730697b34bb989b2cd223b40d7b6651f5714dd14955c5db4581addc61a910");
  assert.equal(bible.books.GEN.chapters[1][1], "EN el principio creó Dios los cielos y la tierra.");
  assert.equal(bible.books.JOH.chapters[3][1], "Y HABÍA un hombre de los Fariseos que se llamaba Nicodemo, príncipe de los Judíos.");
  assert.equal(bible.books.ISA.chapters[41][1], "ESCUCHADME, islas, y esfuércense los pueblos; alléguense, y entonces hablen: estemos juntamente a juicio.");
  assert.equal(
    bible.books.JOH.chapters[3][16],
    "Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, pero tenga vida eterna."
  );
  const featuredLocations = {
    "john-14-27": ["JOH", 14, [27]],
    "psalm-34-18": ["PSA", 34, [18]],
    "isaiah-41-10": ["ISA", 41, [10]],
    "philippians-4-6": ["PHI", 4, [6, 7]],
    "psalm-23-4": ["PSA", 23, [4]],
    "matthew-11-28": ["MAT", 11, [28]],
    "1-thessalonians-5-18": ["1TH", 5, [18]]
  };
  for (const verse of featuredVerses) {
    const [book, chapter, numbers] = featuredLocations[verse.id];
    const exactPdfText = numbers.map((number) => bible.books[book].chapters[chapter][number]).join(" ");
    assert.equal(verse.es, exactPdfText, `${verse.reference.es} debe coincidir con el PDF`);
  }
  for (const book of Object.values(bible.books)) {
    for (const chapter of book.chapters.slice(1)) {
      for (const verse of chapter.slice(1)) assert.doesNotMatch(verse, /\b\d{1,3}\b/, "un número de maquetación entró en el texto");
    }
  }
});

test("al crear una cuenta se integra el progreso local sin perder el remoto", () => {
  const merged = mergeProgress(
    { streak: 12, points: 800, favorites: ["john-14-27"], notes: { a: "remota" }, highlights: { a: "gold" }, verseRecords: { a: { key: "a" } } },
    { streak: 4, points: 120, favorites: ["psalm-23-4"], notes: { b: "local" }, highlights: { b: "sage" }, verseRecords: { b: { key: "b" } } }
  );
  assert.equal(merged.streak, 12);
  assert.equal(merged.points, 800);
  assert.deepEqual(merged.favorites, ["john-14-27", "psalm-23-4"]);
  assert.deepEqual(merged.notes, { a: "remota", b: "local" });
  assert.deepEqual(merged.highlights, { a: "gold", b: "sage" });
  assert.deepEqual(merged.verseRecords, { a: { key: "a" }, b: { key: "b" } });
});

test("el cambio local más reciente de color no es sobrescrito por una copia antigua", () => {
  const saved = {
    highlights: { verse: "gold" },
    notes: { verse: "nota anterior" },
    favorites: ["verse"],
    progressUpdatedAt: "2026-07-15T10:00:00.000Z",
    progressRevision: 4
  };
  const local = {
    highlights: { verse: "sage" },
    notes: {},
    favorites: [],
    progressUpdatedAt: "2026-07-15T10:01:00.000Z",
    progressRevision: 5
  };
  const merged = mergeProgress(saved, local);
  assert.deepEqual(merged.highlights, { verse: "sage" });
  assert.deepEqual(merged.notes, {});
  assert.deepEqual(merged.favorites, []);
  assert.equal(merged.progressRevision, 5);
});

test("el autoguardado por campo conserva a la vez la nota remota y el color local más recientes", () => {
  const saved = {
    notes: { verse: "nota remota nueva" },
    highlights: { verse: "gold" },
    progressUpdatedAt: "2026-07-17T10:10:00.000Z",
    fieldUpdatedAt: {
      notes: "2026-07-17T10:10:00.000Z",
      highlights: "2026-07-17T10:00:00.000Z"
    }
  };
  const local = {
    notes: { verse: "nota local antigua" },
    highlights: { verse: "sage" },
    progressUpdatedAt: "2026-07-17T10:05:00.000Z",
    fieldUpdatedAt: {
      notes: "2026-07-17T10:00:00.000Z",
      highlights: "2026-07-17T10:05:00.000Z"
    }
  };
  const merged = mergeProgress(saved, local);
  assert.deepEqual(merged.notes, { verse: "nota remota nueva" });
  assert.deepEqual(merged.highlights, { verse: "sage" });
});

test("la nube antigua no puede reponer la oración falsa del día actual", () => {
  const cloudV3 = {
    dataSchemaVersion: 3,
    streak: 9,
    lastPrayerDate: "2026-07-15",
    lastPrayerCompletedAt: "2026-07-15T01:00:00.000Z",
    progressUpdatedAt: "2026-07-15T10:05:00.000Z"
  };
  const migratedLocal = {
    dataSchemaVersion: 4,
    streak: 9,
    lastPrayerDate: "2026-07-14",
    lastPrayerCompletedAt: null,
    prayerCompletions: {},
    progressUpdatedAt: "2026-07-15T10:00:00.000Z"
  };
  const merged = mergeProgress(cloudV3, migratedLocal);
  assert.equal(merged.dataSchemaVersion, 4);
  assert.equal(merged.lastPrayerDate, "2026-07-14");
  assert.deepEqual(merged.prayerCompletions, {});
  const completed = completePrayer(merged, new Date(2026, 6, 15, 22), "night");
  assert.equal(completed.streak, 10);
});

test("el plan anual cubre los 1.189 capítulos exactamente una vez", () => {
  const expected = books.flatMap((book) => Array.from({ length: book.chapters }, (_, index) => `${book.id}:${index + 1}`));
  const actual = YEAR_READING_PLAN.flatMap((day) => day.chapters.map((chapter) => `${chapter.bookId}:${chapter.chapter}`));
  assert.equal(YEAR_READING_PLAN.length, READING_PLAN_DAYS);
  assert.equal(actual.length, 1189);
  assert.deepEqual(actual, expected);
  assert.equal(new Set(actual).size, 1189);
  assert.deepEqual(getReadingPlanDay(1).chapters[0], { bookId: "GEN", chapter: 1 });
  assert.deepEqual(getReadingPlanDay(365).chapters.at(-1), { bookId: "REV", chapter: 22 });
  assert.equal(getReadingPlanWeek(53).length, 1);
  assert.equal(getCompletedBookProgress("GEN", []), 0);
  assert.equal(getCompletedBookProgress("GEN", [1]), 6);
});

test("la versión mínima permite bloquear instalaciones antiguas", () => {
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("1.0.0", "1.1.0"), -1);
  assert.equal(compareVersions("2.0.0", "1.9.9"), 1);
});

test("la versión 1.9.0 usa el nuevo enlace de Bold y los anuncios iOS entregados", () => {
  assert.equal(APP_VERSION, "1.9.0");
  assert.equal(BOLD_CHECKOUT_URL, "https://checkout.bold.co/payment/LNK_84NNU7YDX9");
  assert.equal(ADMOB_IDS.iosAppId, "ca-app-pub-8007313797348394~9653183215");
  assert.equal(ADMOB_IDS.appOpen.iosProduction, "ca-app-pub-8007313797348394/7027019877");
  assert.equal(ADMOB_IDS.achievementInterstitial.iosProduction, "ca-app-pub-8007313797348394/8172580587");
});

test("la interfaz detiene multimedia, traduce tras confirmar la selección y comparte imágenes de forma nativa", async () => {
  const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const androidShareSource = await readFile(new URL("../android/app/src/main/java/com/duobiblia/app/VerseSharePlugin.java", import.meta.url), "utf8");
  assert.match(appSource, /appStateChange/);
  assert.match(appSource, /data-action="translate-selection"/);
  assert.doesNotMatch(appSource, /scheduleAutomaticTranslation/);
  assert.match(appSource, /NativeVerseShare\.shareImage/);
  assert.match(appSource, /devotional-interactive-text/);
  assert.match(appSource, /STORAGE_BACKUP_KEY/);
  assert.match(appSource, /audio\.volume = 0\.82/);
  assert.match(appSource, /translationMode/);
  assert.match(androidShareSource, /Intent\.ACTION_SEND/);
  assert.match(androidShareSource, /image\/png/);
});

test("los recordatorios diarios usan la hora local de mañana, tarde y noche", () => {
  const schedule = prayerNotificationSchedule("es");
  assert.deepEqual(schedule.map(({ hour, minute }) => [hour, minute]), [[7, 0], [15, 0], [21, 30]]);
  assert.equal(prayerNotificationSchedule("en")[2].title, "End the day in peace");
});

test("Android e iOS incluyen el sonido breve de guitarra para recordatorios", async () => {
  const androidSound = await readFile(new URL("../android/app/src/main/res/raw/duobiblia_guitar_calm.wav", import.meta.url));
  const iosSound = await readFile(new URL("../ios/App/App/duobiblia_guitar_calm.wav", import.meta.url));
  const serviceSource = await readFile(new URL("../src/notification-service.mjs", import.meta.url), "utf8");
  assert.ok(androidSound.length > 100000);
  assert.deepEqual(androidSound, iosSound);
  assert.match(serviceSource, /daily-prayer-guitar-v2/);
  assert.match(serviceSource, /LocalNotifications\.getPending/);
});

test("la edición publicable protege consentimiento, eliminación de cuenta y pagos de tienda", async () => {
  const adsSource = await readFile(new URL("../src/ads.mjs", import.meta.url), "utf8");
  const deleteAccountSource = await readFile(new URL("../supabase/functions/delete-account/index.ts", import.meta.url), "utf8");
  const buildScript = await readFile(new URL("../scripts/build-android-apk.ps1", import.meta.url), "utf8");
  assert.match(adsSource, /requestConsentInfo/);
  assert.match(adsSource, /showConsentForm/);
  assert.match(deleteAccountSource, /auth\.admin\.deleteUser/);
  assert.match(buildScript, /\[switch\]\$PlayStore/);
  assert.match(buildScript, /VITE_EXTERNAL_BILLING_ENABLED = if \(\$PlayStore\.IsPresent\) \{ 'false' \}/);
});
