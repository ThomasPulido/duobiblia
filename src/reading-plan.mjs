import { books } from "./core.mjs";

export const READING_PLAN_DAYS = 365;

const canonicalChapters = books.flatMap((book) =>
  Array.from({ length: book.chapters }, (_, index) => ({
    bookId: book.id,
    chapter: index + 1
  }))
);

function groupSegments(chapters) {
  return chapters.reduce((segments, item) => {
    const previous = segments.at(-1);
    if (previous?.bookId === item.bookId && previous.endChapter + 1 === item.chapter) {
      previous.endChapter = item.chapter;
    } else {
      segments.push({ bookId: item.bookId, startChapter: item.chapter, endChapter: item.chapter });
    }
    return segments;
  }, []);
}

function segmentLabel(segment, language) {
  const book = books.find((item) => item.id === segment.bookId) || books[0];
  const chapters = segment.startChapter === segment.endChapter
    ? `${segment.startChapter}`
    : `${segment.startChapter}–${segment.endChapter}`;
  return `${book[language]} ${chapters}`;
}

export const YEAR_READING_PLAN = Array.from({ length: READING_PLAN_DAYS }, (_, index) => {
  const day = index + 1;
  const start = Math.floor(index * canonicalChapters.length / READING_PLAN_DAYS);
  const end = Math.floor(day * canonicalChapters.length / READING_PLAN_DAYS);
  const chapters = canonicalChapters.slice(start, end);
  const segments = groupSegments(chapters);
  return {
    day,
    week: Math.ceil(day / 7),
    chapters,
    segments,
    minutes: chapters.length > 3 ? 15 : 12,
    labels: {
      es: segments.map((segment) => segmentLabel(segment, "es")).join(" · "),
      en: segments.map((segment) => segmentLabel(segment, "en")).join(" · ")
    }
  };
});

export function getReadingPlanDay(day) {
  return YEAR_READING_PLAN[Number(day) - 1] || null;
}

export function getReadingPlanWeek(week) {
  const safeWeek = Math.max(1, Math.min(53, Number(week) || 1));
  const startDay = (safeWeek - 1) * 7 + 1;
  return YEAR_READING_PLAN.slice(startDay - 1, startDay + 6);
}

export function findReadingPlanChapter(day, bookId, chapter) {
  const planDay = getReadingPlanDay(day);
  if (!planDay) return -1;
  return planDay.chapters.findIndex((item) => item.bookId === bookId && item.chapter === Number(chapter));
}

export function nextIncompletePlanDay(completedDays = []) {
  const completed = new Set(completedDays.map(Number));
  return YEAR_READING_PLAN.find((item) => !completed.has(item.day))?.day || READING_PLAN_DAYS;
}

export function getCompletedBookProgress(bookId, completedDays = []) {
  const book = books.find((item) => item.id === bookId);
  if (!book) return 0;
  const completed = new Set(completedDays.map(Number));
  const completedChapters = YEAR_READING_PLAN
    .filter((day) => completed.has(day.day))
    .flatMap((day) => day.chapters)
    .filter((chapter) => chapter.bookId === bookId).length;
  return Math.round(completedChapters / book.chapters * 100);
}
