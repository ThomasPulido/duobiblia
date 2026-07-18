export function mergeProgress(saved = {}, local = {}) {
  const savedUpdatedAt = Date.parse(saved.progressUpdatedAt || "") || 0;
  const localUpdatedAt = Date.parse(local.progressUpdatedAt || "") || 0;
  const hasVersionedProgress = Boolean(savedUpdatedAt || localUpdatedAt);
  const newer = localUpdatedAt >= savedUpdatedAt ? local : saved;
  const older = newer === local ? saved : local;
  const fieldTimestamp = (value, field) => Date.parse(value.fieldUpdatedAt?.[field] || value.progressUpdatedAt || "") || 0;
  const fieldSource = (field) => fieldTimestamp(local, field) >= fieldTimestamp(saved, field) ? local : saved;
  const hasFieldHistory = Boolean(
    Object.keys(saved.fieldUpdatedAt || {}).length
      || Object.keys(local.fieldUpdatedAt || {}).length
      || hasVersionedProgress
  );
  const mutable = hasFieldHistory ? {
    favorites: [...(fieldSource("favorites").favorites || [])],
    notes: { ...(fieldSource("notes").notes || {}) },
    highlights: { ...(fieldSource("highlights").highlights || {}) }
  } : {
    favorites: [...new Set([...(saved.favorites || []), ...(local.favorites || [])])],
    notes: { ...(saved.notes || {}), ...(local.notes || {}) },
    highlights: { ...(saved.highlights || {}), ...(local.highlights || {}) }
  };
  const fieldUpdatedAt = {};
  for (const field of new Set([...Object.keys(saved.fieldUpdatedAt || {}), ...Object.keys(local.fieldUpdatedAt || {})])) {
    const source = fieldSource(field);
    fieldUpdatedAt[field] = source.fieldUpdatedAt?.[field] || source.progressUpdatedAt || null;
  }
  const savedPrayerAt = Date.parse(saved.lastPrayerCompletedAt || "") || 0;
  const localPrayerAt = Date.parse(local.lastPrayerCompletedAt || "") || 0;
  const prayerSource = localPrayerAt >= savedPrayerAt ? local : saved;
  const savedHasRituals = (Number(saved.dataSchemaVersion) || 0) >= 4;
  const localHasRituals = (Number(local.dataSchemaVersion) || 0) >= 4;
  const ritualSchema = savedHasRituals || localHasRituals;
  const ritualSource = savedHasRituals && localHasRituals ? newer : (localHasRituals ? local : saved);
  return {
    ...older,
    ...newer,
    streak: Math.max(Number(saved.streak) || 0, Number(local.streak) || 0),
    points: Math.max(Number(saved.points) || 0, Number(local.points) || 0),
    readChapters: [...new Set([...(saved.completedPlanDays || []), ...(local.completedPlanDays || [])].map(Number))].length,
    completedPlanDays: [...new Set([...(saved.completedPlanDays || []), ...(local.completedPlanDays || [])].map(Number))].sort((a, b) => a - b),
    completedDevotionalDays: [...new Set([...(saved.completedDevotionalDays || []), ...(local.completedDevotionalDays || [])])],
    dataSchemaVersion: Math.max(Number(saved.dataSchemaVersion) || 0, Number(local.dataSchemaVersion) || 0),
    lastPrayerDate: ritualSchema ? (ritualSource.lastPrayerDate || null) : (prayerSource.lastPrayerDate || newer.lastPrayerDate || older.lastPrayerDate || null),
    lastPrayerCompletedAt: ritualSchema ? (ritualSource.lastPrayerCompletedAt || null) : (prayerSource.lastPrayerCompletedAt || null),
    prayerCompletions: {
      ...(savedHasRituals ? (saved.prayerCompletions || {}) : {}),
      ...(localHasRituals ? (local.prayerCompletions || {}) : {})
    },
    favorites: [...(mutable.favorites || [])],
    notes: { ...(mutable.notes || {}) },
    highlights: { ...(mutable.highlights || {}) },
    verseRecords: { ...(older.verseRecords || {}), ...(newer.verseRecords || {}) },
    progressUpdatedAt: newer.progressUpdatedAt || older.progressUpdatedAt || null,
    progressRevision: Math.max(Number(saved.progressRevision) || 0, Number(local.progressRevision) || 0),
    fieldUpdatedAt
  };
}
