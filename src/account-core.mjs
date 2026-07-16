export function mergeProgress(saved = {}, local = {}) {
  const savedUpdatedAt = Date.parse(saved.progressUpdatedAt || "") || 0;
  const localUpdatedAt = Date.parse(local.progressUpdatedAt || "") || 0;
  const hasVersionedProgress = Boolean(savedUpdatedAt || localUpdatedAt);
  const newer = localUpdatedAt >= savedUpdatedAt ? local : saved;
  const older = newer === local ? saved : local;
  const mutable = hasVersionedProgress ? newer : {
    favorites: [...new Set([...(saved.favorites || []), ...(local.favorites || [])])],
    notes: { ...(saved.notes || {}), ...(local.notes || {}) },
    highlights: { ...(saved.highlights || {}), ...(local.highlights || {}) }
  };
  const savedPrayerAt = Date.parse(saved.lastPrayerCompletedAt || "") || 0;
  const localPrayerAt = Date.parse(local.lastPrayerCompletedAt || "") || 0;
  const prayerSource = localPrayerAt >= savedPrayerAt ? local : saved;
  return {
    ...older,
    ...newer,
    streak: Math.max(Number(saved.streak) || 0, Number(local.streak) || 0),
    points: Math.max(Number(saved.points) || 0, Number(local.points) || 0),
    readChapters: [...new Set([...(saved.completedPlanDays || []), ...(local.completedPlanDays || [])].map(Number))].length,
    completedPlanDays: [...new Set([...(saved.completedPlanDays || []), ...(local.completedPlanDays || [])].map(Number))].sort((a, b) => a - b),
    lastPrayerDate: prayerSource.lastPrayerDate || newer.lastPrayerDate || older.lastPrayerDate || null,
    lastPrayerCompletedAt: prayerSource.lastPrayerCompletedAt || null,
    favorites: [...(mutable.favorites || [])],
    notes: { ...(mutable.notes || {}) },
    highlights: { ...(mutable.highlights || {}) },
    verseRecords: { ...(older.verseRecords || {}), ...(newer.verseRecords || {}) },
    progressUpdatedAt: newer.progressUpdatedAt || older.progressUpdatedAt || null,
    progressRevision: Math.max(Number(saved.progressRevision) || 0, Number(local.progressRevision) || 0)
  };
}
