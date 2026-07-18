export function selectionWords(value = "") {
  return String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function translationMode(value = "") {
  const count = selectionWords(value).length;
  if (!count) return "empty";
  return count <= 2 ? "literal" : "parallel-passage";
}

function normalizedToken(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function tokenList(value = "") {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({ raw, normalized: normalizedToken(raw) }));
}

function locateSelection(selection, source, suppliedRange = null) {
  const sourceTokens = tokenList(source);
  if (!sourceTokens.length) return { sourceTokens, start: 0, end: 0 };
  const requestedStart = Number(suppliedRange?.startIndex);
  const requestedEnd = Number(suppliedRange?.endIndex);
  if (
    Number.isInteger(requestedStart)
    && Number.isInteger(requestedEnd)
    && requestedStart >= 0
    && requestedEnd >= requestedStart
    && requestedEnd < sourceTokens.length
  ) {
    return { sourceTokens, start: requestedStart, end: requestedEnd };
  }
  const selected = tokenList(selection).map((token) => token.normalized).filter(Boolean);
  const normalizedSource = sourceTokens.map((token) => token.normalized);
  for (let start = 0; start <= normalizedSource.length - selected.length; start += 1) {
    if (selected.every((token, offset) => token === normalizedSource[start + offset])) {
      return { sourceTokens, start, end: start + selected.length - 1 };
    }
  }
  return { sourceTokens, start: 0, end: Math.max(0, selected.length - 1) };
}

const ALIGNMENT_STOP_WORDS = new Set([
  "a", "al", "am", "and", "are", "as", "at", "be", "been", "being", "by", "de", "del", "el", "en", "es", "esta", "estan", "for", "from", "in", "is", "la", "las", "lo", "los", "of", "on", "or", "para", "por", "que", "the", "to", "un", "una", "unto", "was", "were", "y"
]);

const ALIGNMENT_EQUIVALENTS = new Map([
  ["jehova", "god"], ["senor", "god"], ["dios", "god"], ["lord", "god"],
  ["cristo", "christ"], ["jesus", "christ"], ["christ", "christ"],
  ["vosotros", "you"], ["ustedes", "you"], ["you", "you"],
  ["dad", "give"], ["dar", "give"], ["den", "give"], ["give", "give"],
  ["gracia", "thanks"], ["gracias", "thanks"], ["thanks", "thanks"],
  ["agradecimiento", "thanks"], ["gratitud", "thanks"]
]);

const ALIGNMENT_BOUNDARY_EQUIVALENTS = new Map([
  ["en", "in"], ["in", "en"]
]);

function comparableToken(value) {
  const normalized = normalizedToken(value);
  return ALIGNMENT_EQUIVALENTS.get(normalized) || normalized;
}

function meaningfulTokens(values) {
  const filtered = values.map(comparableToken).filter((token) => token.length > 1 && !ALIGNMENT_STOP_WORDS.has(token));
  return filtered.length ? filtered : values.map(comparableToken).filter((token) => token.length > 1);
}

function tokensMatch(left, right) {
  if (left === right) return true;
  const shortest = Math.min(left.length, right.length);
  return shortest >= 5 && left.slice(0, shortest - 1) === right.slice(0, shortest - 1);
}

function setOverlap(left, right) {
  const leftTokens = meaningfulTokens(left);
  const rightTokens = meaningfulTokens(right);
  if (!leftTokens.length || !rightTokens.length) return { recall: 0, precision: 0 };
  const used = new Set();
  let matches = 0;
  for (const token of leftTokens) {
    const index = rightTokens.findIndex((candidate, candidateIndex) => !used.has(candidateIndex) && tokensMatch(token, candidate));
    if (index >= 0) {
      used.add(index);
      matches += 1;
    }
  }
  return { recall: matches / leftTokens.length, precision: matches / rightTokens.length };
}

/**
 * Returns a fragment copied verbatim from the integrated parallel passage.
 * A device translation may be supplied only as an alignment hint; its wording
 * is never returned to the reader.
 */
export function alignParallelFragment({ selection, sourceText, targetText, hint = "", range = null } = {}) {
  const targetTokens = tokenList(targetText);
  if (!targetTokens.length) return { text: "", start: 0, end: 0, confidence: 0 };
  const located = locateSelection(selection, sourceText, range);
  const sourceCount = Math.max(1, located.sourceTokens.length);
  const selectedCount = Math.max(1, located.end - located.start + 1);
  if (selectedCount >= sourceCount) {
    return { text: targetTokens.map((token) => token.raw).join(" "), start: 0, end: targetTokens.length - 1, confidence: 1 };
  }

  const targetCount = targetTokens.length;
  const expectedStart = located.start / sourceCount * targetCount;
  const expectedEnd = (located.end + 1) / sourceCount * targetCount;
  const expectedCenter = (expectedStart + expectedEnd) / 2;
  const suppliedHintTokens = tokenList(hint).map((token) => token.normalized).filter(Boolean);
  // Native ML is an optional alignment aid. When it is still warming up or is
  // unavailable, known bilingual lemmas from the selected words keep the
  // fragment anchored without ever returning invented wording.
  const hintTokens = suppliedHintTokens.length
    ? suppliedHintTokens
    : tokenList(selection).map((token) => comparableToken(token.normalized)).filter(Boolean);
  const proportionalLength = Math.max(1, Math.round(selectedCount / sourceCount * targetCount));
  const expectedLength = Math.max(1, hintTokens.length, proportionalLength);
  const minimumLength = Math.max(1, Math.floor(Math.min(expectedLength, proportionalLength) * 0.65));
  const maximumLength = Math.min(targetCount - 1, Math.max(expectedLength, proportionalLength) + 5);
  let best = null;

  for (let start = 0; start < targetCount; start += 1) {
    for (let length = minimumLength; length <= maximumLength && start + length <= targetCount; length += 1) {
      const end = start + length - 1;
      const candidate = targetTokens.slice(start, end + 1);
      const overlap = setOverlap(hintTokens, candidate.map((token) => token.normalized));
      const center = start + length / 2;
      const positionPenalty = Math.abs(center - expectedCenter) / targetCount;
      const lengthPenalty = Math.abs(length - expectedLength) / Math.max(expectedLength, 1);
      const firstToken = comparableToken(candidate[0]?.normalized);
      const lastToken = comparableToken(candidate.at(-1)?.normalized);
      const boundaryPenalty = (ALIGNMENT_STOP_WORDS.has(firstToken) ? 0.12 : 0) + (ALIGNMENT_STOP_WORDS.has(lastToken) ? 0.55 : 0);
      const score = overlap.recall * 5 + overlap.precision - positionPenalty * 2.4 - lengthPenalty * 1.25 - boundaryPenalty;
      if (!best || score > best.score) best = { start, end, score, overlap };
    }
  }

  let start = best?.start ?? Math.max(0, Math.floor(expectedStart));
  let end = best?.end ?? Math.min(targetCount - 1, Math.max(start, Math.ceil(expectedEnd) - 1));
  const selectedNormalized = tokenList(selection).map((token) => token.normalized);
  const previousTarget = targetTokens[start - 1]?.normalized;
  const shouldRestoreLeadingBoundary = start > 0 && selectedNormalized.some(
    (token) => ALIGNMENT_BOUNDARY_EQUIVALENTS.get(token) === previousTarget
  );
  if (shouldRestoreLeadingBoundary) start -= 1;
  const lastComparable = comparableToken(targetTokens[end]?.normalized);
  const compoundHint = meaningfulTokens(hintTokens).some((token) => token.startsWith(lastComparable) && token.length >= lastComparable.length + 3);
  if (compoundHint && end + 1 < targetCount) end += 1;
  const text = targetTokens.slice(start, end + 1).map((token) => token.raw).join(" ");
  const confidence = best ? Math.max(0, Math.min(1, best.overlap.recall * 0.75 + best.overlap.precision * 0.25)) : 0;
  return { text, start, end, confidence };
}

