import { createClient } from "@supabase/supabase-js";

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_PUBLISHABLE_KEY__: string;

const env = import.meta.env as Record<string, string | undefined>;
const injectedUrl =
  typeof __SUPABASE_URL__ === "string" ? __SUPABASE_URL__ : "";
const injectedKey =
  typeof __SUPABASE_PUBLISHABLE_KEY__ === "string"
    ? __SUPABASE_PUBLISHABLE_KEY__
    : "";
const configuredSupabaseUrl = (
  env.VITE_SUPABASE_URL ||
  env.SUPABASE_URL ||
  injectedUrl
).trim();
const hasValidSupabaseUrl = (() => {
  try {
    const url = new URL(configuredSupabaseUrl);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
})();
const supabaseUrl = hasValidSupabaseUrl
  ? configuredSupabaseUrl
  : "https://placeholder.supabase.co";
const configuredPublishableKey = (
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  env.SUPABASE_PUBLISHABLE_KEY ||
  env.SUPABASE_ANON_KEY ||
  injectedKey
).trim();
const supabasePublishableKey =
  configuredPublishableKey || "placeholder-publishable-key";

export const supabaseAuthStorageKey = "fleet-manager-auth";

export const supabaseConfigured =
  hasValidSupabaseUrl &&
  Boolean(configuredPublishableKey) &&
  configuredPublishableKey !== "placeholder-publishable-key";

// Use PKCE explicitly instead of relying on the SDK's implicit-flow default.
// The verifier is kept by Supabase Auth in browser storage and is consumed once
// when the OAuth callback returns. No application data is stored here.
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    // The callback is exchanged explicitly in AuthProvider. Keeping URL
    // detection off avoids a race between Supabase's auto-initializer and the
    // React auth gate when returning from Google.
    detectSessionInUrl: false,
    flowType: "pkce",
    // Use an app-specific namespace so stale auth state from an older flow
    // cannot be mistaken for the current Google login attempt.
    storageKey: supabaseAuthStorageKey,
  },
});