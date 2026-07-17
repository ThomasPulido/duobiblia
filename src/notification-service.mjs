import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const PRAYER_NOTIFICATION_IDS = [7101, 7102, 7103];
const CHANNEL_ID = "daily-prayer-guitar-v2";
const SOUND_FILE = "duobiblia_guitar_calm.wav";
let listenerInstalled = false;

const notificationCopy = {
  es: [
    {
      id: 7101,
      hour: 7,
      minute: 0,
      title: "Comienza el día con Dios",
      body: "Tu oración de la mañana está lista. Respira, escucha y recibe la Palabra."
    },
    {
      id: 7102,
      hour: 15,
      minute: 0,
      title: "Haz una pausa de oración",
      body: "Renueva tus fuerzas para continuar la tarde con paz."
    },
    {
      id: 7103,
      hour: 21,
      minute: 30,
      title: "Termina el día en paz",
      body: "Es momento de agradecer, entregar lo que pesa y descansar con Dios."
    }
  ],
  en: [
    {
      id: 7101,
      hour: 7,
      minute: 0,
      title: "Begin your day with God",
      body: "Your morning prayer is ready. Breathe, listen, and receive the Word."
    },
    {
      id: 7102,
      hour: 15,
      minute: 0,
      title: "Take a prayer pause",
      body: "Renew your strength and continue the afternoon in peace."
    },
    {
      id: 7103,
      hour: 21,
      minute: 30,
      title: "End the day in peace",
      body: "Give thanks, release what weighs on you, and rest with God."
    }
  ]
};

export function prayerNotificationSchedule(language = "es") {
  return (notificationCopy[language] || notificationCopy.es).map((item) => ({ ...item }));
}

function nativeOnly() {
  return Capacitor.isNativePlatform();
}

function hasCurrentSchedule(notifications = []) {
  return PRAYER_NOTIFICATION_IDS.every((id) => notifications.some((notification) =>
    notification.id === id
      && (Capacitor.getPlatform() !== "android" || notification.channelId === CHANNEL_ID)
      && (Capacitor.getPlatform() === "android" || notification.sound === SOUND_FILE)
  ));
}

export async function initializePrayerNotifications(onPrayerOpened) {
  if (!nativeOnly() || listenerInstalled) return;
  listenerInstalled = true;
  await LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
    if (PRAYER_NOTIFICATION_IDS.includes(event.notification.id)) onPrayerOpened?.();
  });
}

export async function prayerNotificationPermission() {
  if (!nativeOnly()) return "unsupported";
  const status = await LocalNotifications.checkPermissions();
  return status.display;
}

export async function enablePrayerNotifications(language = "es") {
  if (!nativeOnly()) return { enabled: false, reason: "unsupported" };

  let permission = await LocalNotifications.checkPermissions();
  if (permission.display === "prompt" || permission.display === "prompt-with-rationale") {
    permission = await LocalNotifications.requestPermissions();
  }
  if (permission.display !== "granted") return { enabled: false, reason: "denied" };

  if (Capacitor.getPlatform() === "android") {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: language === "es" ? "Oraciones diarias" : "Daily prayers",
      description: language === "es"
        ? "Recordatorios de oración de la mañana, tarde y noche"
        : "Morning, afternoon, and night prayer reminders",
      importance: 4,
      visibility: 1,
      vibration: true,
      sound: SOUND_FILE
    });
  }

  await LocalNotifications.cancel({
    notifications: PRAYER_NOTIFICATION_IDS.map((id) => ({ id }))
  });
  const copy = prayerNotificationSchedule(language);
  await LocalNotifications.schedule({
    notifications: copy.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      channelId: CHANNEL_ID,
      sound: SOUND_FILE,
      schedule: {
        on: { hour: item.hour, minute: item.minute },
        repeats: true,
        allowWhileIdle: true
      },
      extra: { route: "prayer", period: item.id === 7101 ? "morning" : item.id === 7102 ? "afternoon" : "night" }
    }))
  });
  const pending = await LocalNotifications.getPending();
  const scheduled = hasCurrentSchedule(pending.notifications);
  return { enabled: scheduled, reason: scheduled ? null : "not-scheduled" };
}

export async function disablePrayerNotifications() {
  if (!nativeOnly()) return false;
  await LocalNotifications.cancel({
    notifications: PRAYER_NOTIFICATION_IDS.map((id) => ({ id }))
  });
  return true;
}

export async function refreshPrayerNotifications(language = "es") {
  if (await prayerNotificationPermission() !== "granted") return false;
  const pending = await LocalNotifications.getPending();
  if (hasCurrentSchedule(pending.notifications)) return true;
  return (await enablePrayerNotifications(language)).enabled;
}
