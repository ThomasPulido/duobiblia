import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { books, completeDailyPrayer, dateKey, featuredVerses, getDailyVerse, getLocalDayPeriod, getMoodVerse, getWordHelp, hasCompletedDailyPrayer, normalizeWord, progressPercent, searchFeatured, wordDictionary } from "../src/core.mjs";
import { chooseNextTrack, prayerTracks } from "../src/music.mjs";
import { mergeProgress } from "../src/account-core.mjs";
import { compareVersions } from "../src/update-service.mjs";
import { APP_VERSION } from "../src/update-service.mjs";
import { BOLD_CHECKOUT_URL } from "../src/billing-service.mjs";
import { ADMOB_IDS } from "../src/config.mjs";
import { prayerNotificationSchedule } from "../src/notification-service.mjs";
import { getCompletedBookProgress, getReadingPlanDay, getReadingPlanWeek, READING_PLAN_DAYS, YEAR_READING_PLAN } from "../src/reading-plan.mjs";

test("completar la oración inicia una racha y entrega puntos", () => {
  const result = completeDailyPrayer({ streak: 0, points: 0, lastPrayerDate: null }, new Date(2026, 6, 13, 9));
  assert.equal(result.streak, 1);
  assert.equal(result.points, 50);
  assert.equal(result.newlyCompleted, true);
});

test("completar dos veces el mismo día no duplica la recompensa", () => {
  const result = completeDailyPrayer({ streak: 8, points: 450, lastPrayerDate: "2026-07-13" }, new Date(2026, 6, 13, 18));
  assert.equal(result.streak, 8);
  assert.equal(result.points, 450);
  assert.equal(result.newlyCompleted, false);
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

test("la versión 1.5.0 usa el nuevo enlace de Bold y los anuncios iOS entregados", () => {
  assert.equal(APP_VERSION, "1.5.0");
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
  assert.match(androidShareSource, /Intent\.ACTION_SEND/);
  assert.match(androidShareSource, /image\/png/);
});

test("los recordatorios diarios usan la hora local de mañana, tarde y noche", () => {
  const schedule = prayerNotificationSchedule("es");
  assert.deepEqual(schedule.map(({ hour, minute }) => [hour, minute]), [[7, 0], [15, 0], [21, 30]]);
  assert.equal(prayerNotificationSchedule("en")[2].title, "End the day in peace");
});
