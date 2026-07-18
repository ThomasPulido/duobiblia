import devotionalYear from "./devotional-year.json" with { type: "json" };

export const DEVOTIONAL_DAYS = devotionalYear.days.length;
export const DEVOTIONAL_TITLE = devotionalYear.title;
export const DEVOTIONAL_SUBTITLE = devotionalYear.subtitle;
export const DEVOTIONAL_SUGGESTED_PRAYERS = devotionalYear.suggestedPrayerCount;

export function devotionalIndexForDate(date = new Date()) {
  const id = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const index = devotionalYear.days.findIndex((day) => day.id === id);
  if (index >= 0) return index;
  if (id === "02-29") return devotionalYear.days.findIndex((day) => day.id === "02-28");
  return 0;
}

export function getDailyYouthDevotional(date = new Date()) {
  return devotionalYear.days[devotionalIndexForDate(date)];
}

export function getYouthDevotional(index = devotionalIndexForDate()) {
  const normalized = ((Number(index) || 0) % DEVOTIONAL_DAYS + DEVOTIONAL_DAYS) % DEVOTIONAL_DAYS;
  return devotionalYear.days[normalized];
}

export function getYouthDevotionalMonth(month) {
  return devotionalYear.days.filter((day) => day.month === Number(month));
}

export { devotionalYear };
