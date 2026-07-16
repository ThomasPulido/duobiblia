export const STREAK_GOAL = 90;

export const featuredVerses = [
  {
    id: "john-14-27",
    book: { es: "Juan", en: "John" },
    chapter: 14,
    verse: 27,
    reference: { es: "Juan 14:27", en: "John 14:27" },
    es: "La paz os dejo, mi paz os doy: no como el mundo la da, yo os la doy. No se turbe vuestro corazón, ni tenga miedo.",
    en: "Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.",
    topics: ["paz", "ansiedad", "miedo"]
  },
  {
    id: "psalm-34-18",
    book: { es: "Salmos", en: "Psalms" },
    chapter: 34,
    verse: 18,
    reference: { es: "Salmos 34:18", en: "Psalms 34:18" },
    es: "Cercano está Jehová a los quebrantados de corazón; Y salvará a los contritos de espíritu.",
    en: "The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit.",
    topics: ["tristeza", "consuelo", "esperanza"]
  },
  {
    id: "isaiah-41-10",
    book: { es: "Isaías", en: "Isaiah" },
    chapter: 41,
    verse: 10,
    reference: { es: "Isaías 41:10", en: "Isaiah 41:10" },
    es: "No temas, que yo soy contigo; no desmayes, que yo soy tu Dios que te esfuerzo: siempre te ayudaré, siempre te sustentaré con la diestra de mi justicia.",
    en: "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.",
    topics: ["miedo", "fortaleza", "ansiedad"]
  },
  {
    id: "philippians-4-6",
    book: { es: "Filipenses", en: "Philippians" },
    chapter: 4,
    verse: "6-7",
    reference: { es: "Filipenses 4:6-7", en: "Philippians 4:6-7" },
    es: "Por nada estéis afanosos; sino sean notorias vuestras peticiones delante de Dios en toda oración y ruego, con hacimiento de gracias. Y la paz de Dios, que sobrepuja todo entendimiento, guardará vuestros corazones y vuestros entendimientos en Cristo Jesús.",
    en: "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.",
    topics: ["ansiedad", "oración", "gratitud"]
  },
  {
    id: "psalm-23-4",
    book: { es: "Salmos", en: "Psalms" },
    chapter: 23,
    verse: 4,
    reference: { es: "Salmos 23:4", en: "Psalms 23:4" },
    es: "Aunque ande en valle de sombra de muerte, No temeré mal alguno; porque tú estarás conmigo: Tu vara y tu cayado me infundirán aliento.",
    en: "Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.",
    topics: ["miedo", "protección", "paz"]
  },
  {
    id: "matthew-11-28",
    book: { es: "Mateo", en: "Matthew" },
    chapter: 11,
    verse: 28,
    reference: { es: "Mateo 11:28", en: "Matthew 11:28" },
    es: "Venid a mí todos los que estáis trabajados y cargados, que yo os haré descansar.",
    en: "Come unto me, all ye that labour and are heavy laden, and I will give you rest.",
    topics: ["cansancio", "descanso", "paz"]
  },
  {
    id: "1-thessalonians-5-18",
    book: { es: "1 Tesalonicenses", en: "1 Thessalonians" },
    chapter: 5,
    verse: 18,
    reference: { es: "1 Tesalonicenses 5:18", en: "1 Thessalonians 5:18" },
    es: "Dad gracias en todo; porque esta es la voluntad de Dios para con vosotros en Cristo Jesús.",
    en: "In every thing give thanks: for this is the will of God in Christ Jesus concerning you.",
    topics: ["gratitud", "bendiciones", "gozo"]
  }
];

export const moodOptions = [
  { id: "peaceful", emoji: "😌", label: { es: "En paz", en: "Peaceful" }, verseId: "john-14-27" },
  { id: "anxious", emoji: "😟", label: { es: "Con ansiedad", en: "Anxious" }, verseId: "philippians-4-6" },
  { id: "sad", emoji: "😢", label: { es: "Triste", en: "Sad" }, verseId: "psalm-34-18" },
  { id: "grateful", emoji: "🥰", label: { es: "Agradecido", en: "Grateful" }, verseId: "1-thessalonians-5-18" },
  { id: "tired", emoji: "😴", label: { es: "Cansado", en: "Tired" }, verseId: "matthew-11-28" },
  { id: "afraid", emoji: "😨", label: { es: "Con miedo", en: "Afraid" }, verseId: "isaiah-41-10" }
];

const baseTranslations = {
  a: "un/una", afraid: "con miedo/atemorizado", all: "todo(s)", am: "soy/estoy", and: "y", are: "son/están", art: "eres/estás",
  as: "como", be: "ser/estar", broken: "quebrantado", but: "pero/sino", by: "por", careful: "afanosos/preocupados",
  christ: "Cristo", come: "venir", comfort: "consolar", concerning: "respecto a", contrite: "contrito",
  death: "muerte", dismayed: "desalentado", every: "cada", evil: "mal", fear: "temer", for: "porque/para",
  give: "dar", giveth: "da", god: "Dios", hand: "mano/diestra", heart: "corazón", hearts: "corazones",
  heavy: "cargado", help: "ayudar", i: "yo", in: "en", is: "está/es", it: "ello/lo", jesus: "Jesús",
  keep: "guardar", known: "conocido/dadas a conocer", labour: "trabajar/estar fatigado", laden: "cargado", leave: "dejar", let: "dejar/permitir",
  lord: "Jehová/Señor", made: "hechas", me: "mí/me", minds: "pensamientos", my: "mi", neither: "ni tampoco",
  nigh: "cerca", no: "ningún/no", not: "no", nothing: "nada", of: "de", passeth: "sobrepasa",
  peace: "paz", prayer: "oración", requests: "peticiones", rest: "descanso", right: "derecha/diestra",
  righteousness: "justicia", rod: "vara", saveth: "salva", shadow: "sombra", shall: "habrá/guardará",
  spirit: "espíritu", staff: "cayado", strengthen: "fortalecer", such: "tales/los que", supplication: "ruego",
  thanks: "gracias", that: "que", the: "el/la/los/las", thee: "ti/te", them: "ellos/los", they: "ellos", thing: "cosa",
  this: "esta/esto", thou: "tú", though: "aunque", through: "por medio de", thy: "tu", thanksgiving: "acción de gracias",
  understanding: "entendimiento", unto: "a/para", uphold: "sostener", valley: "valle", walk: "andar/caminar", which: "que/el cual", will: "voluntad/auxiliar futuro",
  with: "con", world: "mundo", yea: "sí/ciertamente", ye: "vosotros/ustedes", you: "tú/te/ustedes", your: "tu/su/vuestro"
};

export const wordDictionary = Object.fromEntries(
  Object.entries(baseTranslations).map(([word, es]) => [word, {
    es,
    pronunciation: "Escuchar",
    type: "palabra",
    meaning: `Traducción básica: ${es}. El sentido exacto puede variar según la frase.`,
    phrase: word,
    phraseEs: es
  }])
);

Object.assign(wordDictionary, {
  i: { es: "yo", pronunciation: "/aɪ/", type: "pronombre", meaning: "Pronombre que usa una persona para hablar de sí misma.", phrase: "I give unto you", phraseEs: "Yo os doy" },
  peace: { es: "paz", pronunciation: "/piːs/", type: "sustantivo", meaning: "En Juan 14:27 expresa la paz interior que Jesús entrega, no solo ausencia de conflicto.", phrase: "Peace I leave with you", phraseEs: "La paz os dejo" },
  leave: { es: "dejo", pronunciation: "/liːv/", type: "verbo", meaning: "En este contexto significa entregar o confiar algo que permanece.", phrase: "Peace I leave with you", phraseEs: "La paz os dejo" },
  give: { es: "doy/dar", pronunciation: "/ɡɪv/", type: "verbo", meaning: "Entregar voluntariamente. La forma depende del sujeto y del tiempo verbal.", phrase: "I give unto you", phraseEs: "Yo os doy" },
  world: { es: "mundo", pronunciation: "/wɜːrld/", type: "sustantivo", meaning: "En Juan 14 se refiere a la manera humana o terrenal de ofrecer seguridad.", phrase: "as the world giveth", phraseEs: "como el mundo la da" },
  heart: { es: "corazón", pronunciation: "/hɑːrt/", type: "sustantivo", meaning: "En el contexto bíblico puede representar el centro de los pensamientos, decisiones y emociones.", phrase: "your heart", phraseEs: "vuestro corazón" },
  troubled: { es: "turbado/angustiado", pronunciation: "/ˈtrʌbəld/", type: "adjetivo", meaning: "Inquieto, perturbado o afligido.", phrase: "be troubled", phraseEs: "se turbe" },
  lord: { es: "Jehová/Señor", pronunciation: "/lɔːrd/", type: "título", meaning: "Título divino; en este Salmo corresponde al nombre de Dios traducido como Jehová en tu Biblia española.", phrase: "The LORD is nigh", phraseEs: "Cercano está Jehová" },
  nigh: { es: "cerca", pronunciation: "/naɪ/", type: "adverbio arcaico", meaning: "Forma antigua de ‘near’: próximo o cercano.", phrase: "is nigh unto them", phraseEs: "está cercano a ellos" },
  saveth: { es: "salva", pronunciation: "/ˈseɪvɪθ/", type: "verbo arcaico", meaning: "Forma antigua de ‘saves’: rescata o libra.", phrase: "and saveth such", phraseEs: "y salva a los" },
  thou: { es: "tú", pronunciation: "/ðaʊ/", type: "pronombre arcaico", meaning: "Forma antigua singular de ‘you’ usada como sujeto.", phrase: "Fear thou not", phraseEs: "No temas" },
  thee: { es: "ti/te", pronunciation: "/ðiː/", type: "pronombre arcaico", meaning: "Forma antigua singular de ‘you’ usada como complemento.", phrase: "I will help thee", phraseEs: "te ayudaré" },
  thy: { es: "tu", pronunciation: "/ðaɪ/", type: "posesivo arcaico", meaning: "Forma antigua de ‘your’ para una sola persona.", phrase: "thy rod", phraseEs: "tu vara" },
  prayer: { es: "oración", pronunciation: "/prer/", type: "sustantivo", meaning: "Comunicación reverente con Dios.", phrase: "by prayer and supplication", phraseEs: "en toda oración y ruego" },
  supplication: { es: "ruego/súplica", pronunciation: "/ˌsʌplɪˈkeɪʃən/", type: "sustantivo", meaning: "Petición humilde y ferviente dirigida a Dios.", phrase: "prayer and supplication", phraseEs: "oración y ruego" },
  thanksgiving: { es: "acción de gracias", pronunciation: "/ˌθæŋksˈɡɪvɪŋ/", type: "sustantivo", meaning: "Expresión consciente de gratitud.", phrase: "with thanksgiving", phraseEs: "con acción de gracias" },
  labour: { es: "trabajados/fatigados", pronunciation: "/ˈleɪbər/", type: "verbo", meaning: "En Mateo 11:28 describe a quienes están cansados por el trabajo o las cargas.", phrase: "all ye that labour", phraseEs: "todos los que estáis trabajados" },
  laden: { es: "cargados", pronunciation: "/ˈleɪdən/", type: "adjetivo", meaning: "Que lleva una carga pesada, literal o emocional.", phrase: "are heavy laden", phraseEs: "estáis cargados" }
});

export const topics = [
  { id: "amor", emoji: "♥", color: "coral", label: { es: "Amor", en: "Love" }, verseId: "john-14-27" },
  { id: "paz", emoji: "☁", color: "blue", label: { es: "Paz", en: "Peace" }, verseId: "john-14-27" },
  { id: "fe", emoji: "✦", color: "gold", label: { es: "Fe", en: "Faith" }, verseId: "isaiah-41-10" },
  { id: "perdon", emoji: "↻", color: "sage", label: { es: "Perdón", en: "Forgiveness" }, verseId: "psalm-34-18" },
  { id: "bendiciones", emoji: "☀", color: "gold", label: { es: "Bendiciones", en: "Blessings" }, verseId: "1-thessalonians-5-18" },
  { id: "salvacion", emoji: "✝", color: "coral", label: { es: "Salvación", en: "Salvation" }, verseId: "psalm-34-18" }
];

const canon = [
  ["GEN", "Génesis", "Genesis", 50], ["EXO", "Éxodo", "Exodus", 40], ["LEV", "Levítico", "Leviticus", 27],
  ["NUM", "Números", "Numbers", 36], ["DEU", "Deuteronomio", "Deuteronomy", 34], ["JOS", "Josué", "Joshua", 24],
  ["JDG", "Jueces", "Judges", 21], ["RUT", "Rut", "Ruth", 4], ["1SA", "1 Samuel", "1 Samuel", 31],
  ["2SA", "2 Samuel", "2 Samuel", 24], ["1KI", "1 Reyes", "1 Kings", 22], ["2KI", "2 Reyes", "2 Kings", 25],
  ["1CH", "1 Crónicas", "1 Chronicles", 29], ["2CH", "2 Crónicas", "2 Chronicles", 36], ["EZR", "Esdras", "Ezra", 10],
  ["NEH", "Nehemías", "Nehemiah", 13], ["EST", "Ester", "Esther", 10], ["JOB", "Job", "Job", 42],
  ["PSA", "Salmos", "Psalms", 150], ["PRO", "Proverbios", "Proverbs", 31], ["ECC", "Eclesiastés", "Ecclesiastes", 12],
  ["SOL", "Cantares", "Song of Solomon", 8], ["ISA", "Isaías", "Isaiah", 66], ["JER", "Jeremías", "Jeremiah", 52],
  ["LAM", "Lamentaciones", "Lamentations", 5], ["EZE", "Ezequiel", "Ezekiel", 48], ["DAN", "Daniel", "Daniel", 12],
  ["HOS", "Oseas", "Hosea", 14], ["JOE", "Joel", "Joel", 3], ["AMO", "Amós", "Amos", 9],
  ["OBA", "Abdías", "Obadiah", 1], ["JON", "Jonás", "Jonah", 4], ["MIC", "Miqueas", "Micah", 7],
  ["NAH", "Nahúm", "Nahum", 3], ["HAB", "Habacuc", "Habakkuk", 3], ["ZEP", "Sofonías", "Zephaniah", 3],
  ["HAG", "Hageo", "Haggai", 2], ["ZEC", "Zacarías", "Zechariah", 14], ["MAL", "Malaquías", "Malachi", 4],
  ["MAT", "Mateo", "Matthew", 28], ["MAR", "Marcos", "Mark", 16], ["LUK", "Lucas", "Luke", 24],
  ["JOH", "Juan", "John", 21], ["ACT", "Hechos", "Acts", 28], ["ROM", "Romanos", "Romans", 16],
  ["1CO", "1 Corintios", "1 Corinthians", 16], ["2CO", "2 Corintios", "2 Corinthians", 13], ["GAL", "Gálatas", "Galatians", 6],
  ["EPH", "Efesios", "Ephesians", 6], ["PHI", "Filipenses", "Philippians", 4], ["COL", "Colosenses", "Colossians", 4],
  ["1TH", "1 Tesalonicenses", "1 Thessalonians", 5], ["2TH", "2 Tesalonicenses", "2 Thessalonians", 3], ["1TI", "1 Timoteo", "1 Timothy", 6],
  ["2TI", "2 Timoteo", "2 Timothy", 4], ["TIT", "Tito", "Titus", 3], ["PHM", "Filemón", "Philemon", 1],
  ["HEB", "Hebreos", "Hebrews", 13], ["JAM", "Santiago", "James", 5], ["1PE", "1 Pedro", "1 Peter", 5],
  ["2PE", "2 Pedro", "2 Peter", 3], ["1JO", "1 Juan", "1 John", 5], ["2JO", "2 Juan", "2 John", 1],
  ["3JO", "3 Juan", "3 John", 1], ["JUD", "Judas", "Jude", 1], ["REV", "Apocalipsis", "Revelation", 22]
];

export const books = canon.map(([id, es, en, chapters]) => ({ id, es, en, chapters }));

export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDailyVerse(date = new Date(), offset = 0) {
  const localDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNumber = Math.floor(localDay / 86400000);
  const index = ((dayNumber + offset) % featuredVerses.length + featuredVerses.length) % featuredVerses.length;
  return featuredVerses[index];
}

export function getLocalDayPeriod(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "night";
}

export function previousDateKey(date = new Date()) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - 1);
  return dateKey(copy);
}

export function completeDailyPrayer(progress, now = new Date()) {
  const today = dateKey(now);
  if (hasCompletedDailyPrayer(progress, now)) return { ...progress, newlyCompleted: false };
  const continued = progress.lastPrayerDate === previousDateKey(now);
  return {
    ...progress,
    streak: continued ? progress.streak + 1 : 1,
    points: progress.points + 50,
    lastPrayerDate: today,
    lastPrayerCompletedAt: now.toISOString(),
    newlyCompleted: true
  };
}

export function hasCompletedDailyPrayer(progress, now = new Date()) {
  const completedAt = progress?.lastPrayerCompletedAt;
  if (completedAt) {
    const parsed = new Date(completedAt);
    if (!Number.isNaN(parsed.getTime())) return dateKey(parsed) === dateKey(now);
  }
  return progress?.lastPrayerDate === dateKey(now);
}

export function getVerse(id) {
  return featuredVerses.find((verse) => verse.id === id) || featuredVerses[0];
}

export function getMoodVerse(moodId) {
  const mood = moodOptions.find((item) => item.id === moodId) || moodOptions[0];
  return getVerse(mood.verseId);
}

export function normalizeWord(word) {
  return word.toLowerCase().replace(/[^a-z']/g, "");
}

export function getWordHelp(word) {
  const normalized = normalizeWord(word);
  const local = wordDictionary[normalized];
  if (local) return { ...local, known: true };
  return {
    known: false,
    es: "Traducción contextual disponible con el diccionario conectado",
    pronunciation: "—",
    type: "palabra",
    meaning: "Esta palabra se resolverá con el servicio de traducción de producción.",
    phrase: word,
    phraseEs: "Toca la frase para traducirla completa"
  };
}

export function progressPercent(streak) {
  return Math.min(100, Math.round((streak / STREAK_GOAL) * 100));
}

export function searchFeatured(query, lang = "es") {
  const cleaned = query.trim().toLowerCase();
  if (!cleaned) return featuredVerses;
  return featuredVerses.filter((verse) => `${verse.reference[lang]} ${verse[lang]} ${verse.topics.join(" ")}`.toLowerCase().includes(cleaned));
}
