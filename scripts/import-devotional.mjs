import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourcePath = resolve(process.argv[2] || "content/valientes-por-dentro.md");
const outputPath = resolve(process.argv[3] || "src/devotional-year.json");
const calendarPath = resolve(process.argv[4] || "src/devotional-calendar.json");
const monthNumbers = new Map([
  ["enero", 1], ["febrero", 2], ["marzo", 3], ["abril", 4], ["mayo", 5], ["junio", 6],
  ["julio", 7], ["agosto", 8], ["septiembre", 9], ["octubre", 10], ["noviembre", 11], ["diciembre", 12]
]);
const bookIds = new Map([
  ["génesis", "GEN"], ["éxodo", "EXO"], ["levítico", "LEV"], ["números", "NUM"], ["deuteronomio", "DEU"],
  ["josué", "JOS"], ["jueces", "JDG"], ["rut", "RUT"], ["1 samuel", "1SA"], ["2 samuel", "2SA"],
  ["1 reyes", "1KI"], ["2 reyes", "2KI"], ["1 crónicas", "1CH"], ["2 crónicas", "2CH"], ["esdras", "EZR"],
  ["nehemías", "NEH"], ["ester", "EST"], ["job", "JOB"], ["salmos", "PSA"], ["salmo", "PSA"],
  ["proverbios", "PRO"], ["eclesiastés", "ECC"], ["cantares", "SOL"], ["isaías", "ISA"], ["jeremías", "JER"],
  ["lamentaciones", "LAM"], ["ezequiel", "EZE"], ["daniel", "DAN"], ["oseas", "HOS"], ["joel", "JOE"],
  ["amós", "AMO"], ["abdías", "OBA"], ["jonás", "JON"], ["miqueas", "MIC"], ["nahúm", "NAH"],
  ["habacuc", "HAB"], ["sofonías", "ZEP"], ["hageo", "HAG"], ["zacarías", "ZEC"], ["malaquías", "MAL"],
  ["mateo", "MAT"], ["marcos", "MAR"], ["lucas", "LUK"], ["juan", "JOH"], ["hechos", "ACT"],
  ["romanos", "ROM"], ["1 corintios", "1CO"], ["2 corintios", "2CO"], ["gálatas", "GAL"], ["efesios", "EPH"],
  ["filipenses", "PHI"], ["colosenses", "COL"], ["1 tesalonicenses", "1TH"], ["2 tesalonicenses", "2TH"],
  ["1 timoteo", "1TI"], ["2 timoteo", "2TI"], ["tito", "TIT"], ["filemón", "PHM"], ["hebreos", "HEB"],
  ["santiago", "JAM"], ["1 pedro", "1PE"], ["2 pedro", "2PE"], ["1 juan", "1JO"], ["2 juan", "2JO"],
  ["3 juan", "3JO"], ["judas", "JUD"], ["apocalipsis", "REV"]
]);

const normalizeLineBreaks = (value) => value.replace(/\r\n?/g, "\n");
const cleanBlock = (value = "") => value
  .replace(/^---\s*$/gm, "")
  .trim()
  .split(/\n\s*\n/)
  .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
  .filter(Boolean);

function parseReference(value) {
  const normalizedReference = String(value).replace(/^basado en\s+/i, "").trim();
  const match = normalizedReference.match(/^(.+?)\s+(\d+):(\d+)/);
  if (!match) return { bookId: null, chapter: null, verse: null };
  return {
    bookId: bookIds.get(match[1].trim().toLowerCase()) || null,
    chapter: Number(match[2]),
    verse: Number(match[3])
  };
}

function between(section, startPattern, endPattern = null) {
  const start = section.search(startPattern);
  if (start < 0) return "";
  const afterStart = section.slice(start).replace(startPattern, "");
  if (!endPattern) return afterStart;
  const end = afterStart.search(endPattern);
  return end < 0 ? afterStart : afterStart.slice(0, end);
}

const source = normalizeLineBreaks(await readFile(sourcePath, "utf8"));
const monthThemes = Object.fromEntries([...source.matchAll(/^## ([A-ZÁÉÍÓÚÑ]+) — (.+)$/gm)]
  .map((match) => [match[1].toLowerCase(), match[2].trim()]));
const headings = [...source.matchAll(/^### (\d{1,2}) de ([a-záéíóúñ]+) — (.+)$/gm)];
const days = headings.map((heading, index) => {
  const day = Number(heading[1]);
  const monthName = heading[2].toLowerCase();
  const month = monthNumbers.get(monthName);
  const title = heading[3].trim();
  const sectionEnd = headings[index + 1]?.index ?? source.indexOf("\n## PALABRAS FINALES", heading.index);
  const section = source.slice(heading.index + heading[0].length, sectionEnd > 0 ? sectionEnd : source.length);
  const verseMatch = section.match(/^\*\*Versículo:\*\*\s+«(.+?)»\s+\((.+?)\)\s*$/m);
  const verseQuote = verseMatch?.[1]?.trim() || "";
  const reference = verseMatch?.[2]?.trim() || "";
  const bodyStart = verseMatch ? section.indexOf(verseMatch[0]) + verseMatch[0].length : 0;
  const body = cleanBlock(section.slice(bodyStart).split(/^\*\*Reflexión:\*\*/m)[0]);
  const reflection = cleanBlock(between(section, /^\*\*Reflexión:\*\*/m, /^\*\*Reto de hoy:\*\*/m)).join("\n\n");
  const challenge = cleanBlock(between(section, /^\*\*Reto de hoy:\*\*/m, /^\*\*Oración:\*\*/m)).join("\n\n");
  const providedPrayer = cleanBlock(between(section, /^\*\*Oración:\*\*/m)).join("\n\n");
  const prayerSuggested = !providedPrayer;
  const prayer = providedPrayer || "Señor, ayúdame a recibir esta reflexión con humildad y a poner en práctica el reto de hoy. Dame sabiduría, constancia y valentía para crecer contigo. Amén.";
  return {
    id: `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    day,
    month,
    monthName,
    monthTheme: monthThemes[monthName] || "",
    title,
    verseQuote,
    reference,
    ...parseReference(reference),
    body,
    reflection,
    challenge,
    prayer,
    prayerSuggested
  };
});

if (days.length !== 365) throw new Error(`Se esperaban 365 días y se encontraron ${days.length}.`);
if (new Set(days.map((day) => day.id)).size !== 365) throw new Error("Hay fechas duplicadas en la matutina.");
for (const day of days) {
  for (const field of ["title", "verseQuote", "reference", "body", "reflection", "challenge", "prayer"]) {
    if (!day[field] || (Array.isArray(day[field]) && !day[field].length)) throw new Error(`${day.id} no tiene ${field}.`);
  }
}

const payload = {
  title: "Valientes por dentro",
  subtitle: "Un año para atreverte, conocerte y no conformarte",
  source: "Texto anual entregado por el propietario del proyecto",
  suggestedPrayerCount: days.filter((day) => day.prayerSuggested).length,
  days
};
await writeFile(outputPath, `${JSON.stringify(payload)}\n`, "utf8");
await writeFile(calendarPath, `${JSON.stringify({
  title: payload.title,
  subtitle: payload.subtitle,
  suggestedPrayerCount: payload.suggestedPrayerCount,
  days: days.map(({ id, day, month, monthName, monthTheme, title, verseQuote }) => ({ id, day, month, monthName, monthTheme, title, verseQuote }))
})}\n`, "utf8");
console.log(`Matutina importada: ${days.length} días; ${payload.suggestedPrayerCount} oraciones sugeridas.`);
