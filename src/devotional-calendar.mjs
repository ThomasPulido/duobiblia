import calendar from "./devotional-calendar.json" with { type: "json" };

export const DEVOTIONAL_DAYS = calendar.days.length;
export const DEVOTIONAL_TITLE = calendar.title;
export const DEVOTIONAL_SUBTITLE = calendar.subtitle;
export const DEVOTIONAL_SUGGESTED_PRAYERS = calendar.suggestedPrayerCount;

export function devotionalIndexForDate(date = new Date()) {
  const id = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const index = calendar.days.findIndex((day) => day.id === id);
  if (index >= 0) return index;
  if (id === "02-29") return calendar.days.findIndex((day) => day.id === "02-28");
  return 0;
}

export function getDailyYouthDevotionalPreview(date = new Date()) {
  return calendar.days[devotionalIndexForDate(date)];
}

export function getYouthDevotionalPreview(index = devotionalIndexForDate()) {
  const normalized = ((Number(index) || 0) % DEVOTIONAL_DAYS + DEVOTIONAL_DAYS) % DEVOTIONAL_DAYS;
  return calendar.days[normalized];
}
