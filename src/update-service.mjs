import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

export const APP_VERSION = "1.4.0";

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

export async function checkRequiredUpdate() {
  const configuredManifestUrl = import.meta.env.VITE_UPDATE_MANIFEST_URL || "";
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  const platform = Capacitor.getPlatform();
  try {
    const platformKey = platform === "ios" || platform === "android" ? platform : "web";
    let url = configuredManifestUrl;
    let usesSupabase = false;
    const headers = {};
    if (!url && supabaseUrl && supabaseKey) {
      usesSupabase = true;
      url = `${supabaseUrl}/rest/v1/app_versions?platform=eq.${platformKey}&select=*`;
      headers.apikey = supabaseKey;
      headers.Authorization = `Bearer ${supabaseKey}`;
    }
    if (!url) url = "./version.json";
    const requestUrl = usesSupabase ? url : `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
    const response = await fetch(requestUrl, { cache: "no-store", headers });
    if (!response.ok) return null;
    const payload = await response.json();
    const row = Array.isArray(payload) ? payload[0] : null;
    const manifest = row ? {
      latestVersion: row.latest_version,
      minimumVersion: row.minimum_version,
      storeUrl: row.store_url,
      title: row.title,
      message: row.message
    } : payload;
    if (compareVersions(APP_VERSION, manifest.minimumVersion || APP_VERSION) >= 0) return null;
    return {
      ...manifest,
      storeUrl: manifest.storeUrl || (platform === "ios" ? manifest.iosUrl : manifest.androidUrl)
    };
  } catch {
    return null;
  }
}

export async function openRequiredUpdate(update) {
  if (!update?.storeUrl) return;
  await Browser.open({ url: update.storeUrl });
}

export { compareVersions };
