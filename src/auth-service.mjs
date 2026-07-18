import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { createClient } from "@supabase/supabase-js";
import { mergeProgress } from "./account-core.mjs";

export { mergeProgress } from "./account-core.mjs";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const nativeRedirect = "com.duobiblia.app://auth/callback";

export const authConfigured = Boolean(supabaseUrl && supabaseKey);
export const supabase = authConfigured ? createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce"
  }
}) : null;

export async function getAuthCapabilities() {
  if (!authConfigured) return { email: false, google: false, profiles: false };
  try {
    const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };
    const [settingsResponse, profilesResponse] = await Promise.all([
      fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseKey } }),
      fetch(`${supabaseUrl}/rest/v1/profiles?select=user_id&limit=1`, { headers })
    ]);
    const settings = settingsResponse.ok ? await settingsResponse.json() : null;
    return {
      email: settings ? Boolean(settings.external?.email) : true,
      google: settings ? Boolean(settings.external?.google) : false,
      profiles: profilesResponse.ok
    };
  } catch {
    return { email: true, google: false, profiles: false };
  }
}

export async function initializeAuth(onSession) {
  if (!supabase) return () => {};
  const { data } = await supabase.auth.getSession();
  onSession(data.session || null);
  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => onSession(session));

  let appUrlListener;
  if (Capacitor.isNativePlatform()) {
    appUrlListener = await App.addListener("appUrlOpen", async ({ url }) => {
      if (!url.startsWith(nativeRedirect)) return;
      await Browser.close().catch(() => {});
      const code = new URL(url).searchParams.get("code");
      if (code) await supabase.auth.exchangeCodeForSession(code);
    });
  }
  return () => {
    listener.subscription.unsubscribe();
    appUrlListener?.remove();
  };
}

export async function sendEmailCode(email) {
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true }
  });
  if (error) throw error;
}

export async function verifyEmailCode(email, token) {
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
  return data.session;
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");
  const native = Capacitor.isNativePlatform();
  const redirectTo = native ? nativeRedirect : `${location.origin}${location.pathname}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: native }
  });
  if (error) throw error;
  if (native && data.url) await Browser.open({ url: data.url, presentationStyle: "popover" });
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function deleteAccount() {
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error("ACCOUNT_REQUIRED");
  const { error } = await supabase.functions.invoke("delete-account", {
    body: { confirmation: "DELETE_DUOBIBLIA_ACCOUNT" }
  });
  if (error) throw error;
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
}

let progressSyncQueue = Promise.resolve();

async function performProgressSync(user, progress) {
  if (!supabase || !user) return null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: existing, error: readError } = await supabase
      .from("profiles")
      .select("progress,updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) throw readError;
    const mergedProgress = mergeProgress(existing?.progress, progress);
    const payload = {
      email: user.email,
      display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0],
      progress: mergedProgress,
      updated_at: new Date().toISOString()
    };
    if (!existing) {
      const { data, error } = await supabase.from("profiles")
        .upsert({ ...payload, user_id: user.id }, { onConflict: "user_id" })
        .select("user_id,email,display_name,premium_until,progress")
        .single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase.from("profiles")
      .update(payload)
      .eq("user_id", user.id)
      .eq("updated_at", existing.updated_at)
      .select("user_id,email,display_name,premium_until,progress")
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  throw new Error("PROGRESS_SYNC_CONFLICT");
}

export function syncProgress(user, progress) {
  const operation = progressSyncQueue.catch(() => {}).then(() => performProgressSync(user, progress));
  progressSyncQueue = operation.catch(() => {});
  return operation;
}

export async function getEntitlement(user) {
  if (!supabase || !user) return { premium: false, premiumUntil: null };
  const { data, error } = await supabase.from("profiles").select("premium_until").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  const premiumUntil = data?.premium_until || null;
  return { premium: Boolean(premiumUntil && new Date(premiumUntil) > new Date()), premiumUntil };
}

export async function claimStreakReward(user) {
  if (!supabase || !user) throw new Error("ACCOUNT_REQUIRED");
  const { data, error } = await supabase.rpc("claim_streak_reward");
  if (error) throw error;
  return { premium: Boolean(data && new Date(data) > new Date()), premiumUntil: data || null };
}
