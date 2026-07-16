import { books, wordDictionary } from "./core.mjs";
import { annualDayIndex } from "./daily-content.mjs";

const dual = (es, en) => ({ es: String(es), en: String(en) });

function arrangeOptions(correct, distractors, seed) {
  const unique = [correct, ...distractors].filter((option, index, values) =>
    values.findIndex((item) => item.es === option.es && item.en === option.en) === index
  ).slice(0, 4);
  const offset = seed % unique.length;
  const options = [...unique.slice(offset), ...unique.slice(0, offset)];
  return { options, correctIndex: options.findIndex((option) => option.es === correct.es && option.en === correct.en) };
}

function nearbyBookOptions(correctIndex, language, seed) {
  const candidates = [];
  for (let step = 1; candidates.length < 3; step += 1) {
    const book = books[(correctIndex + step * 11 + seed) % books.length];
    if (book.id !== books[correctIndex].id) candidates.push(dual(book.es, book.en));
  }
  return candidates;
}

function bookQuestion(id, prompt, correctBookIndex, seed, explanation) {
  const correct = dual(books[correctBookIndex].es, books[correctBookIndex].en);
  const arranged = arrangeOptions(correct, nearbyBookOptions(correctBookIndex, "both", seed), seed);
  return { id, category: "bible", prompt, context: dual("Canon bíblico de 66 libros", "66-book biblical canon"), explanation, ...arranged };
}

const chapterQuestions = books.map((book, index) => {
  const correct = dual(book.chapters, book.chapters);
  const distractorValues = [book.chapters + 1, Math.max(1, book.chapters - 1), book.chapters + 3];
  return {
    id: `bible-chapters-${book.id}`,
    category: "bible",
    prompt: dual(`¿Cuántos capítulos tiene ${book.es}?`, `How many chapters does ${book.en} have?`),
    context: dual("Conoce la estructura de la Biblia", "Learn the structure of the Bible"),
    explanation: dual(`${book.es} tiene ${book.chapters} capítulos.`, `${book.en} has ${book.chapters} chapters.`),
    ...arrangeOptions(correct, distractorValues.map((value) => dual(value, value)), index)
  };
});

const testamentQuestions = books.map((book, index) => {
  const oldTestament = index < 39;
  const correct = oldTestament ? dual("Antiguo Testamento", "Old Testament") : dual("Nuevo Testamento", "New Testament");
  return {
    id: `bible-testament-${book.id}`,
    category: "bible",
    prompt: dual(`¿En qué testamento está ${book.es}?`, `Which testament contains ${book.en}?`),
    context: dual("Ubica cada libro en el canon", "Place each book in the canon"),
    explanation: dual(`${book.es} pertenece al ${correct.es}.`, `${book.en} belongs to the ${correct.en}.`),
    ...arrangeOptions(correct, [dual("Antiguo Testamento", "Old Testament"), dual("Nuevo Testamento", "New Testament"), dual("En ambos", "In both"), dual("En ninguno", "In neither")], index)
  };
});

const positionQuestions = books.map((book, index) => {
  const position = index + 1;
  return {
    id: `bible-position-${book.id}`,
    category: "bible",
    prompt: dual(`¿Qué número ocupa ${book.es} entre los 66 libros?`, `What position does ${book.en} hold among the 66 books?`),
    context: dual("Orden tradicional del canon", "Traditional canonical order"),
    explanation: dual(`${book.es} es el libro ${position}.`, `${book.en} is book ${position}.`),
    ...arrangeOptions(dual(position, position), [position + 1, Math.max(1, position - 1), Math.min(66, position + 4)].map((value) => dual(value, value)), index)
  };
});

const nextQuestions = books.slice(0, -1).map((book, index) => bookQuestion(
  `bible-next-${book.id}`,
  dual(`¿Qué libro viene después de ${book.es}?`, `Which book comes after ${book.en}?`),
  index + 1,
  index,
  dual(`Después de ${book.es} viene ${books[index + 1].es}.`, `${books[index + 1].en} comes after ${book.en}.`)
));

const previousQuestions = books.slice(1).map((book, offset) => {
  const index = offset + 1;
  return bookQuestion(
    `bible-previous-${book.id}`,
    dual(`¿Qué libro viene antes de ${book.es}?`, `Which book comes before ${book.en}?`),
    index - 1,
    index + 7,
    dual(`Antes de ${book.es} está ${books[index - 1].es}.`, `${books[index - 1].en} comes before ${book.en}.`)
  );
});

const inversePositionQuestions = books.slice(0, 37).map((book, index) => bookQuestion(
  `bible-book-number-${index + 1}`,
  dual(`¿Cuál es el libro número ${index + 1}?`, `Which book is number ${index + 1}?`),
  index,
  index + 13,
  dual(`El libro número ${index + 1} es ${book.es}.`, `Book number ${index + 1} is ${book.en}.`)
));

export const ANNUAL_BIBLE_QUIZZES = [
  ...chapterQuestions,
  ...testamentQuestions,
  ...positionQuestions,
  ...nextQuestions,
  ...previousQuestions,
  ...inversePositionQuestions
];

const cleanMeaning = (value) => value.split(/[\/;]/)[0].trim();
const wordEntries = Object.entries(wordDictionary).map(([word, help]) => ({ word, meaning: cleanMeaning(help.es) }));

function wordDistractors(index, field) {
  const values = [];
  for (let step = 1; values.length < 3; step += 1) {
    const item = wordEntries[(index + step * 17) % wordEntries.length];
    const label = field === "en" ? item.word : item.meaning;
    if (!values.includes(label)) values.push(label);
  }
  return values;
}

const englishToSpanishBooks = books.map((book, index) => ({
  id: `language-book-en-es-${book.id}`,
  category: "language",
  answerLanguage: "es",
  prompt: dual(`¿Cómo se llama “${book.en}” en español?`, `What is “${book.en}” called in Spanish?`),
  context: dual("Nombres de los libros bíblicos", "Names of Bible books"),
  explanation: dual(`“${book.en}” se llama “${book.es}” en español.`, `“${book.en}” is “${book.es}” in Spanish.`),
  ...arrangeOptions(dual(book.es, book.en), nearbyBookOptions(index, "es", index), index)
}));

const spanishToEnglishBooks = books.map((book, index) => ({
  id: `language-book-es-en-${book.id}`,
  category: "language",
  answerLanguage: "en",
  prompt: dual(`¿Cómo se llama “${book.es}” en inglés?`, `What is “${book.es}” called in English?`),
  context: dual("Nombres de los libros bíblicos", "Names of Bible books"),
  explanation: dual(`“${book.es}” se llama “${book.en}” en inglés.`, `“${book.es}” is “${book.en}” in English.`),
  ...arrangeOptions(dual(book.es, book.en), nearbyBookOptions(index, "en", index + 5), index + 5)
}));

const englishWordQuestions = wordEntries.map((item, index) => ({
  id: `language-word-en-es-${item.word}`,
  category: "language",
  answerLanguage: "es",
  prompt: dual(`¿Qué significa “${item.word}” en español?`, `What does “${item.word}” mean in Spanish?`),
  context: dual("Vocabulario frecuente de la Biblia en inglés", "Frequent vocabulary in the English Bible"),
  explanation: dual(`“${item.word}” significa “${item.meaning}”.`, `“${item.word}” means “${item.meaning}”.`),
  ...arrangeOptions(dual(item.meaning, item.word), wordDistractors(index, "es").map((value) => dual(value, value)), index)
}));

const spanishWordQuestions = wordEntries.map((item, index) => ({
  id: `language-word-es-en-${item.word}`,
  category: "language",
  answerLanguage: "en",
  prompt: dual(`¿Cuál es la palabra inglesa para “${item.meaning}”?`, `Which English word means “${item.meaning}”?`),
  context: dual("Vocabulario bilingüe de la Biblia", "Bilingual Bible vocabulary"),
  explanation: dual(`La palabra inglesa es “${item.word}”.`, `The English word is “${item.word}”.`),
  ...arrangeOptions(dual(item.meaning, item.word), wordDistractors(index, "en").map((value) => dual(value, value)), index + 3)
}));

const spellingQuestions = wordEntries.slice(0, 39).map((item, index) => {
  const variants = [`${item.word}s`, `${item.word}e`, item.word.length > 2 ? `${item.word.slice(0, -1)}i` : `${item.word}x`];
  return {
    id: `language-spelling-${item.word}`,
    category: "language",
    answerLanguage: "en",
    prompt: dual(`¿Cuál es la escritura correcta de “${item.meaning}” en inglés?`, `Which is the correct English spelling for “${item.meaning}”?`),
    context: dual("Ortografía del vocabulario bíblico", "Bible vocabulary spelling"),
    explanation: dual(`La forma correcta es “${item.word}”.`, `The correct spelling is “${item.word}”.`),
    ...arrangeOptions(dual(item.meaning, item.word), variants.map((value) => dual(value, value)), index + 9)
  };
});

export const ANNUAL_LANGUAGE_QUIZZES = [
  ...englishToSpanishBooks,
  ...spanishToEnglishBooks,
  ...englishWordQuestions,
  ...spanishWordQuestions,
  ...spellingQuestions
].slice(0, 365);

export const ANNUAL_QUIZ_SETS = Array.from({ length: 365 }, (_, index) => ({
  day: index + 1,
  language: ANNUAL_LANGUAGE_QUIZZES[index],
  bible: ANNUAL_BIBLE_QUIZZES[index]
}));

export function getDailyQuizSet(date = new Date()) {
  return ANNUAL_QUIZ_SETS[annualDayIndex(date)];
}
