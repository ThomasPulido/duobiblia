import { Capacitor } from "@capacitor/core";
import { AdMob, MaxAdContentRating } from "@capacitor-community/admob";
import { ADMOB_IDS, USE_PRODUCTION_ADS } from "./config.mjs";

let initialized = false;
let interstitialShowing = false;
const INTERSTITIAL_COOLDOWN_MS = 12 * 60 * 1000;
const LAST_INTERSTITIAL_KEY = "duobiblia-last-achievement-ad";

function interstitialIsOnCooldown() {
  const lastShown = Number(sessionStorage.getItem(LAST_INTERSTITIAL_KEY) || 0);
  return Date.now() - lastShown < INTERSTITIAL_COOLDOWN_MS;
}

export async function initializeMobileAds({ premium = false } = {}) {
  if (premium || initialized || !Capacitor.isNativePlatform()) return false;
  try {
    await AdMob.initialize({
      initializeForTesting: !USE_PRODUCTION_ADS,
      maxAdContentRating: MaxAdContentRating.General
    });
    let consentInfo = await AdMob.requestConsentInfo();
    if (!consentInfo.canRequestAds && consentInfo.isConsentFormAvailable) {
      consentInfo = await AdMob.showConsentForm();
    }
    if (!consentInfo.canRequestAds) return false;
    initialized = true;
    return true;
  } catch (error) {
    console.warn("AdMob no pudo inicializarse; la aplicación continuará sin anuncio.", error);
    return false;
  }
}

export async function showAdPrivacyOptions() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await AdMob.showPrivacyOptionsForm();
    return true;
  } catch {
    return false;
  }
}

export async function showAchievementInterstitial({ premium = false } = {}) {
  if (premium || interstitialShowing || interstitialIsOnCooldown() || !Capacitor.isNativePlatform()) return false;
  const ready = initialized || await initializeMobileAds({ premium });
  if (!ready) return false;

  try {
    interstitialShowing = true;
    const platform = Capacitor.getPlatform();
    const productionId = platform === "ios"
      ? ADMOB_IDS.achievementInterstitial.iosProduction
      : ADMOB_IDS.achievementInterstitial.androidProduction;
    if (USE_PRODUCTION_ADS && !productionId) {
      console.warn("Falta el bloque intersticial de AdMob para iOS; no se mostrará un anuncio real.");
      return false;
    }
    await AdMob.prepareInterstitial({
      adId: USE_PRODUCTION_ADS ? productionId : (
        platform === "ios"
          ? ADMOB_IDS.achievementInterstitial.iosTest
          : ADMOB_IDS.achievementInterstitial.androidTest
      ),
      isTesting: !USE_PRODUCTION_ADS
    });
    await AdMob.showInterstitial();
    sessionStorage.setItem(LAST_INTERSTITIAL_KEY, String(Date.now()));
    return true;
  } catch (error) {
    console.warn("El intersticial no estaba disponible; la recompensa no se bloqueó.", error);
    return false;
  } finally {
    interstitialShowing = false;
  }
}
