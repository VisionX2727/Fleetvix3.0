import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseAuthStorageKey, supabaseConfigured } from "@/lib/supabase";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authError: string | null;
  signingIn: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const MINIMUM_SPLASH_MS = 1200;
const AUTH_BOOTSTRAP_TIMEOUT_MS = 6000;
const SUPABASE_CONFIG_ERROR =
  "This build is missing a valid Supabase URL or publishable key.";

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error("Supabase auth initialization timed out")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

function getCallbackError() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const values = [
    query.get("error"),
    query.get("error_code"),
    query.get("error_description"),
    hash.get("error"),
    hash.get("error_code"),
    hash.get("error_description"),
  ].filter((value): value is string => Boolean(value));
  return values.length ? values.join(": ") : null;
}

function formatAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (normalized.includes("failed to fetch") || normalized.includes("fetch failed") || normalized.includes("networkerror")) {
    return "Fleetvix could not reach Supabase. Check this app's Supabase URL and publishable-key configuration, then try again.";
  }
  if (
    normalized.includes("redirect_uri_mismatch") ||
    normalized.includes("invalid_client") ||
    normalized.includes("unauthorized_client")
  ) {
    return "Google rejected the OAuth configuration. Register the callback URL shown under Supabase Authentication → Providers → Google in Google Cloud, and allow this app URL under Supabase Authentication → URL Configuration → Redirect URLs.";
  }
  if (normalized.includes("redirect") && normalized.includes("not allowed")) {
    return "This app URL is not allowed by Supabase. Add the exact current app URL under Supabase Authentication → URL Configuration → Redirect URLs.";
  }
  if (
    normalized.includes("provider_disabled") ||
    (normalized.includes("provider") && normalized.includes("not enabled"))
  ) {
    return "Google sign-in is not fully configured in Supabase. Enable Google under Authentication → Providers and add the Google OAuth client credentials there.";
  }
  if (normalized.includes("invalid api key") || normalized.includes("apikey")) {
    return "The Supabase publishable key configured for this deployment is invalid.";
  }
  if (normalized.includes("access_denied")) {
    return "Google sign-in was denied or cancelled. Retry and approve the requested access for the selected account.";
  }
  if (normalized.includes("oauth state") || normalized.includes("flow_state")) {
    return "Google returned to Fleetvix, but this browser's sign-in state did not match. Allow the exact app URL in Supabase Authentication → URL Configuration → Redirect URLs, then retry in the same browser.";
  }
  if (normalized.includes("code verifier") || normalized.includes("pkce")) {
    return "Google returned to Fleetvix, but this browser no longer has the sign-in verifier. If you opened Fleetvix inside another app, open it directly in Chrome or your full browser, start a fresh sign-in, and finish in that same browser.";
  }
  if (normalized.includes("timed out")) {
    return "Fleetvix could not finish checking your session. Check the Supabase URL and network connection, then try again.";
  }
  return message;
}

function clearOAuthCallbackParams() {
  const url = new URL(window.location.href);
  const callbackParams = [
    "code",
    "state",
    "error",
    "error_code",
    "error_description",
    "sb_flow_id",
    "access_token",
    "refresh_token",
    "expires_in",
    "expires_at",
    "token_type",
    "type",
  ];
  callbackParams.forEach((param) => url.searchParams.delete(param));
  if (url.hash) {
    const hashParams = new URLSearchParams(url.hash.slice(1));
    if (["access_token", "refresh_token", "error", "error_description", "expires_in", "expires_at", "token_type", "type"].some((param) => hashParams.has(param))) {
      url.hash = "";
    }
  }
  window.history.replaceState(window.history.state, document.title, `${url.pathname}${url.search}${url.hash}`);
}

function clearPendingPkceVerifiers() {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (
      key === `${supabaseAuthStorageKey}-code-verifier` ||
      key === `${supabaseAuthStorageKey}-flows-code-verifier` ||
      key?.startsWith(`${supabaseAuthStorageKey}-flow-`)
    ) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
}

function getRedirectUrl() {
  const basePath = import.meta.env.BASE_URL || "/";
  return new URL(basePath, window.location.origin).toString();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) {
      setAuthError(SUPABASE_CONFIG_ERROR);
      setLoading(false);
      return;
    }

    let mounted = true;
    const authStartedAt = Date.now();
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setSigningIn(false);
      if (event === "SIGNED_OUT") setAuthError(null);
    });

    const finishAuthInitialization = async () => {
      const callbackError = getCallbackError();
      if (callbackError) {
        setAuthError(formatAuthError(new Error(callbackError)));
        clearOAuthCallbackParams();
      }

      try {
        const code = new URL(window.location.href).searchParams.get("code");
        if (code && !callbackError) {
          // Exchange exactly once, after the auth listener is registered. This
          // consumes the PKCE verifier created for this browser login attempt.
          const { data, error } = await withTimeout(supabase.auth.exchangeCodeForSession(code), AUTH_BOOTSTRAP_TIMEOUT_MS);
          if (error) throw error;
          if (mounted) setSession(data.session);
          clearOAuthCallbackParams();
        }

        const { data, error } = await withTimeout(supabase.auth.getSession(), AUTH_BOOTSTRAP_TIMEOUT_MS);
        if (!mounted) return;
        if (error) throw error;
        setSession(data.session);
      } catch (error) {
        if (!mounted) return;
        setAuthError(formatAuthError(error));
        clearOAuthCallbackParams();
        setSession(null);
      } finally {
        const remainingSplashTime = Math.max(0, MINIMUM_SPLASH_MS - (Date.now() - authStartedAt));
        window.setTimeout(() => {
          if (mounted) setLoading(false);
        }, remainingSplashTime);
      }
    };

    void finishAuthInitialization();

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user || null,
    session,
    loading,
    authError,
    signingIn,
    signInWithGoogle: async () => {
      if (!supabaseConfigured) {
        setAuthError(SUPABASE_CONFIG_ERROR);
        return;
      }
      setAuthError(null);
      setSigningIn(true);
      clearOAuthCallbackParams();
      clearPendingPkceVerifiers();
      const redirectTo = getRedirectUrl();
       try {
         const { error } = await supabase.auth.signInWithOAuth({
           provider: "google",
           options: {
             redirectTo,
             // Always let the user choose Gmail A or Gmail B instead of reusing
             // the currently active Google browser account.
             queryParams: { prompt: "select_account" },
           },
         });
         if (error) throw error;
       } catch (error) {
         setAuthError(formatAuthError(error));
        setSigningIn(false);
      }
    },
    signOut: async () => {
      // A local logout clears this browser's Supabase session and PKCE
      // verifier without revoking other sessions for the same user.
      const { error } = await supabase.auth.signOut({ scope: "local" });
      clearPendingPkceVerifiers();
      return { error: error ? new Error(error.message) : null };
    },
  }), [session, loading, authError, signingIn]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}