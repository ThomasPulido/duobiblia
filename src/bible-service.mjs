import { books } from "./core.mjs";

export const BIBLE_VERSIONS = {
  kjv: { id: "kjv", label: "KJV", language: "en", file: "kjv.json" },
  "mi-biblia": { id: "mi-biblia", label: "Mi Biblia", language: "es", file: "mi-biblia.json" }
};

const biblePromises = new Map();
const searchIndexPromises = new Map();

function normalizeSearch(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
}

export function loadBible(version = "kjv") {
  const config = BIBLE_VERSIONS[version] || BIBLE_VERSIONS.kjv;
  if (!biblePromises.has(config.id)) {
    biblePromises.set(config.id, fetch(`./data/${config.file}`).then((response) => {
      if (!response.ok) throw new Error(`No fue posible abrir ${config.label} (${response.status}).`);
      return response.json();
    }));
  }
  return biblePromises.get(config.id);
}

export async function getBibleChapter(version, bookId, chapter) {
  const bible = await loadBible(version);
  const verses = bible.books[bookId]?.chapters?.[chapter];
  if (!verses) throw new Error("El capítulo solicitado no está disponible.");
  return verses;
}

export async function searchBible(version, query, limit = 40) {
  const config = BIBLE_VERSIONS[version] || BIBLE_VERSIONS.kjv;
  const bible = await loadBible(config.id);
  const normalized = normalizeSearch(query);
  if (!normalized) return [];

  const matchingBooks = books
    .filter((book) => normalizeSearch(`${book.es} ${book.en}`).includes(normalized))
    .map((book) => ({
      type: "book",
      bookId: book.id,
      book,
      chapterCount: book.chapters,
      reference: book[config.language],
      version: config.id
    }));
  if (normalized.length < 3) return matchingBooks.slice(0, limit);
  const exactBook = matchingBooks.find((item) => [item.book.es, item.book.en].some((name) => normalizeSearch(name) === normalized));
  if (exactBook) return [exactBook];

  if (!searchIndexPromises.has(config.id)) {
    searchIndexPromises.set(config.id, Promise.resolve().then(() => {
      const entries = [];
      for (const book of books) {
        const sourceBook = bible.books[book.id];
        for (let chapter = 1; chapter < sourceBook.chapters.length; chapter += 1) {
          const verses = sourceBook.chapters[chapter] || [];
          for (let verse = 1; verse < verses.length; verse += 1) {
            const value = verses[verse];
            const reference = `${book[config.language]} ${chapter}:${verse}`;
            entries.push({
              searchable: normalizeSearch(`${reference} ${book.es} ${book.en} ${value}`),
              result: { type: "verse", bookId: book.id, book, chapter, verse, text: value, reference, version: config.id }
            });
          }
        }
      }
      return entries;
    }));
  }
  const results = [...matchingBooks];
  const index = await searchIndexPromises.get(config.id);
  for (const entry of index) {
    if (!entry.searchable.includes(normalized)) continue;
    results.push(entry.result);
    if (results.length >= limit) break;
  }
  return results.slice(0, limit);
}

export const loadKjvBible = () => loadBible("kjv");
export const getKjvChapter = (bookId, chapter) => getBibleChapter("kjv", bookId, chapter);
export const searchKjv = (query, limit) => searchBible("kjv", query, limit);
