import { getLocalDayPeriod } from "./core.mjs";

export const ANNUAL_CONTENT_DAYS = 365;

const verseIds = [
  "john-14-27", "psalm-34-18", "isaiah-41-10", "philippians-4-6",
  "psalm-23-4", "matthew-11-28", "1-thessalonians-5-18"
];

const themes = [
  { title: { es: "Paz que permanece", en: "Peace that remains" }, meditation: { es: "La paz de Dios puede sostenerte aun cuando el entorno no cambie de inmediato.", en: "God's peace can hold you even when your surroundings do not change right away." }, prayer: { es: "Llena mi interior de tu paz y enséñame a compartirla.", en: "Fill me with your peace and teach me to share it." } },
  { title: { es: "Confianza para avanzar", en: "Trust to move forward" }, meditation: { es: "Confiar no es conocer cada respuesta; es caminar sabiendo quién te acompaña.", en: "Trust is not knowing every answer; it is walking while knowing who is with you." }, prayer: { es: "Afirma mi confianza cuando no pueda ver el camino completo.", en: "Steady my trust when I cannot see the whole path." } },
  { title: { es: "Gratitud consciente", en: "Mindful gratitude" }, meditation: { es: "La gratitud abre espacio para reconocer la bondad recibida en medio de lo cotidiano.", en: "Gratitude makes room to recognize goodness received in ordinary moments." }, prayer: { es: "Abre mis ojos a tus regalos y hazme agradecido.", en: "Open my eyes to your gifts and make me grateful." } },
  { title: { es: "Fuerza en la debilidad", en: "Strength in weakness" }, meditation: { es: "La debilidad no te aparta de Dios; puede convertirse en el lugar donde recibes ayuda.", en: "Weakness does not push you away from God; it can become the place where you receive help." }, prayer: { es: "Sostén mi debilidad y dame fuerzas para el siguiente paso.", en: "Hold my weakness and give me strength for the next step." } },
  { title: { es: "Sabiduría para elegir", en: "Wisdom to choose" }, meditation: { es: "Una pausa delante de Dios puede cambiar la forma en que respondes y decides.", en: "A pause before God can change the way you respond and decide." }, prayer: { es: "Dame sabiduría, humildad y claridad para elegir bien.", en: "Give me wisdom, humility, and clarity to choose well." } },
  { title: { es: "Perdón que libera", en: "Forgiveness that frees" }, meditation: { es: "Perdonar no llama bueno al daño; entrega a Dios el derecho de sanar y hacer justicia.", en: "Forgiveness does not call harm good; it gives God room to heal and bring justice." }, prayer: { es: "Sana mis heridas y guíame en el camino del perdón.", en: "Heal my wounds and guide me along the path of forgiveness." } },
  { title: { es: "Esperanza renovada", en: "Renewed hope" }, meditation: { es: "La esperanza bíblica no ignora el dolor; espera la fidelidad de Dios dentro de él.", en: "Biblical hope does not ignore pain; it waits for God's faithfulness within it." }, prayer: { es: "Renueva mi esperanza y ayúdame a no rendirme.", en: "Renew my hope and help me not to give up." } },
  { title: { es: "Amor puesto en práctica", en: "Love put into practice" }, meditation: { es: "El amor se vuelve visible en la paciencia, la verdad, el servicio y la atención.", en: "Love becomes visible through patience, truth, service, and attention." }, prayer: { es: "Haz que mi amor se convierta en acciones sinceras.", en: "Let my love become sincere action." } },
  { title: { es: "Descanso para el alma", en: "Rest for the soul" }, meditation: { es: "Descansar también es un acto de confianza: el mundo sigue en las manos de Dios.", en: "Rest is also an act of trust: the world remains in God's hands." }, prayer: { es: "Calma mi mente y enséñame a recibir el descanso.", en: "Quiet my mind and teach me to receive rest." } },
  { title: { es: "Valentía con propósito", en: "Courage with purpose" }, meditation: { es: "La valentía no elimina el temor; decide obedecer a Dios aun mientras tiembla.", en: "Courage does not erase fear; it chooses to obey God even while trembling." }, prayer: { es: "Dame valor para hacer lo correcto con amor.", en: "Give me courage to do what is right with love." } },
  { title: { es: "Presencia en el camino", en: "Presence along the way" }, meditation: { es: "Dios no solo te espera al final; permanece presente en cada parte del camino.", en: "God does not only wait at the finish; he remains present in every part of the journey." }, prayer: { es: "Hazme consciente de tu presencia en cada momento.", en: "Make me aware of your presence in every moment." } },
  { title: { es: "Fe en lo cotidiano", en: "Faith in ordinary life" }, meditation: { es: "La fe crece mediante decisiones pequeñas y constantes, no solo en momentos extraordinarios.", en: "Faith grows through small, steady choices, not only extraordinary moments." }, prayer: { es: "Fortalece mi fe en las tareas sencillas de hoy.", en: "Strengthen my faith in today's simple tasks." } }
];

const focuses = [
  { es: "mis decisiones", en: "my decisions" }, { es: "mi familia", en: "my family" },
  { es: "mi trabajo", en: "my work" }, { es: "mi salud", en: "my health" },
  { es: "mis pensamientos", en: "my thoughts" }, { es: "mis conversaciones", en: "my conversations" },
  { es: "mis planes", en: "my plans" }, { es: "mis temores", en: "my fears" },
  { es: "mi gratitud", en: "my gratitude" }, { es: "mi cansancio", en: "my weariness" },
  { es: "mis relaciones", en: "my relationships" }, { es: "mis finanzas", en: "my finances" },
  { es: "mis estudios", en: "my studies" }, { es: "mi servicio a otros", en: "my service to others" },
  { es: "mi futuro", en: "my future" }, { es: "mi pasado", en: "my past" },
  { es: "mi hogar", en: "my home" }, { es: "mi comunidad", en: "my community" },
  { es: "mi iglesia", en: "my church" }, { es: "mis amistades", en: "my friendships" },
  { es: "quienes me han herido", en: "those who have hurt me" }, { es: "mis esperanzas", en: "my hopes" },
  { es: "mis hábitos", en: "my habits" }, { es: "mi tiempo", en: "my time" },
  { es: "mis palabras", en: "my words" }, { es: "mi cuerpo", en: "my body" },
  { es: "mi descanso", en: "my rest" }, { es: "mi propósito", en: "my purpose" },
  { es: "mis dudas", en: "my doubts" }, { es: "mis alegrías", en: "my joys" },
  { es: "mis necesidades", en: "my needs" }
];

const periods = {
  morning: {
    iconName: "sunrise",
    title: { es: "Oración de la mañana", en: "Morning prayer" },
    intro: { es: "Respira. Dios está aquí.", en: "Breathe. God is here." },
    duration: { es: "7 minutos para comenzar con propósito", en: "7 minutes to begin with purpose" },
    prayerTitle: { es: "Oración para comenzar", en: "A prayer to begin" },
    opening: { es: "Padre celestial, gracias por este nuevo día.", en: "Heavenly Father, thank you for this new day." },
    focus: { es: "Hoy pongo delante de ti", en: "Today I place before you" }
  },
  afternoon: {
    iconName: "sun",
    title: { es: "Pausa de oración", en: "Afternoon prayer pause" },
    intro: { es: "Haz una pausa. Él camina contigo.", en: "Pause. He walks with you." },
    duration: { es: "7 minutos para renovar tus fuerzas", en: "7 minutes to renew your strength" },
    prayerTitle: { es: "Oración para continuar", en: "A prayer to continue" },
    opening: { es: "Señor, hago una pausa y vuelvo mi atención a ti.", en: "Lord, I pause and turn my attention back to you." },
    focus: { es: "Acompáñame mientras te entrego", en: "Stay with me as I entrust to you" }
  },
  night: {
    iconName: "moonStars",
    title: { es: "Oración de la noche", en: "Night prayer" },
    intro: { es: "Descansa. Dios permanece cerca.", en: "Rest. God remains near." },
    duration: { es: "7 minutos para cerrar el día en paz", en: "7 minutes to close the day in peace" },
    prayerTitle: { es: "Oración para descansar", en: "A prayer for rest" },
    opening: { es: "Padre, al terminar este día descanso en tu cuidado.", en: "Father, as this day ends I rest in your care." },
    focus: { es: "Esta noche dejo en tus manos", en: "Tonight I leave in your hands" }
  }
};

function buildExperience(index, period) {
  const theme = themes[index % themes.length];
  const focus = focuses[Math.floor(index / themes.length) % focuses.length];
  const base = periods[period];
  const periodOffset = period === "morning" ? 0 : period === "afternoon" ? 2 : 4;
  return {
    ...base,
    period,
    day: index + 1,
    id: `annual-${index + 1}-${period}`,
    verseId: verseIds[(index + periodOffset) % verseIds.length],
    meditationTitle: theme.title,
    meditation: {
      es: `${theme.meditation.es} En este momento presenta a Dios ${focus.es}; no necesitas resolverlo todo antes de acercarte a él.`,
      en: `${theme.meditation.en} In this moment bring ${focus.en} to God; you do not need to solve everything before coming near to him.`
    },
    prayer: {
      es: `${base.opening.es} ${base.focus.es} ${focus.es}. ${theme.prayer.es} Guía mis próximos pasos y forma en mí un corazón fiel. En el nombre de Jesús, amén.`,
      en: `${base.opening.en} ${base.focus.en} ${focus.en}. ${theme.prayer.en} Guide my next steps and form a faithful heart in me. In Jesus' name, amen.`
    }
  };
}

export const ANNUAL_DEVOTIONALS = Array.from({ length: ANNUAL_CONTENT_DAYS }, (_, index) => ({
  day: index + 1,
  morning: buildExperience(index, "morning"),
  afternoon: buildExperience(index, "afternoon"),
  night: buildExperience(index, "night")
}));

export function annualDayIndex(date = new Date()) {
  const start = Date.UTC(date.getFullYear(), 0, 1);
  const current = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const day = Math.floor((current - start) / 86400000);
  return Math.min(ANNUAL_CONTENT_DAYS - 1, Math.max(0, day));
}

export function getAnnualDevotional(date = new Date(), requestedPeriod = getLocalDayPeriod(date)) {
  const period = periods[requestedPeriod] ? requestedPeriod : getLocalDayPeriod(date);
  return ANNUAL_DEVOTIONALS[annualDayIndex(date)][period];
}
