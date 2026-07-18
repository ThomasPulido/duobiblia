import { Browser } from "@capacitor/browser";

export const PRIVACY_POLICY_URL = "https://thomaspulido.github.io/DuoBiblia/privacy.html";
export const ACCOUNT_DELETION_URL = "https://thomaspulido.github.io/DuoBiblia/delete-account.html";

export async function openPrivacyPolicy() {
  await Browser.open({ url: PRIVACY_POLICY_URL, presentationStyle: "popover" });
}

export async function openAccountDeletionPage() {
  await Browser.open({ url: ACCOUNT_DELETION_URL, presentationStyle: "popover" });
}
