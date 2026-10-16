import { ArrowRight, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import fleetXLogo from "@assets/FleetX_1785676635299.jpeg";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.26Z" />
      <path fill="#34A853" d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.5Z" />
      <path fill="#FBBC05" d="M6.54 13.58a5.85 5.85 0 0 1 0-3.16V7.89H3.3a9.5 9.5 0 0 0 0 8.22l3.24-2.53Z" />
      <path fill="#EA4335" d="M12 6.39c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.47 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.7 5.39l3.24 2.53C7.31 8.11 9.46 6.39 12 6.39Z" />
    </svg>
  );
}

export default function Login({ adminOnly = false }: { adminOnly?: boolean }) {
  const { signInWithGoogle, signingIn, authError } = useAuth();
  const isEmbeddedPreview = window.self !== window.top;
  const appRedirectUrl = new URL(import.meta.env.BASE_URL || "/", window.location.origin).toString();

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5 py-8 text-foreground">
      <div className="w-full max-w-md">
        <header className="mb-9 text-center">
          <img src={fleetXLogo} alt="Fleetvix logo" className="fm-login-logo mx-auto" />
          <h1 className="mt-5 text-4xl font-black tracking-tight">Fleetvix</h1>
          <p className="mx-auto mt-3 max-w-sm text-base font-medium leading-relaxed text-muted-foreground">
            Run your vehicles, work logs, drivers and accounts from one place.
          </p>
        </header>

        <section className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-7 shadow-xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-primary" aria-hidden="true" />
          <div className="mb-8 flex items-start gap-4">
            <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 text-primary">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {adminOnly ? "Admin sign in" : "Sign in to continue"}
              </h2>
              <p className="mt-1 text-sm leading-snug text-muted-foreground">
                {adminOnly
                  ? "Authorized administrators can manage Fleetvix support and accounts."
                  : "Your Fleetvix records are saved to your Google account."}
              </p>
            </div>
          </div>

          {isEmbeddedPreview && (
            <p className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
              For a reliable Google sign-in,{" "}
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-primary underline underline-offset-2"
              >
                open Fleetvix in a new tab
              </a>{" "}
              and complete sign-in in that browser.
            </p>
          )}

          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            disabled={signingIn}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary p-4 font-bold text-primary-foreground shadow-[0_4px_14px_rgba(245,158,11,0.3)] transition-all hover:bg-primary/90 active:scale-[.98] disabled:cursor-wait disabled:opacity-60"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950">
              <GoogleMark />
            </span>
            <span>{signingIn ? "Opening Google..." : "Continue with Google"}</span>
            <ArrowRight size={19} className="ml-1" />
          </button>

          {authError && (
            <div
              role="alert"
              aria-live="assertive"
              className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive"
            >
              <p>{authError}</p>
              {/callback|code verifier|sign-in verifier|pkce|flow_state|sign-in state/i.test(authError) && (
                <div className="mt-3 space-y-2 text-xs opacity-90">
                  <p>Allow this exact address in Supabase Authentication → URL Configuration → Redirect URLs:</p>
                  <code className="block break-all rounded-lg bg-black/20 p-2 select-all">{appRedirectUrl}</code>
                </div>
              )}
            </div>
          )}

          <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
            Only your signed-in account can access its fleet workspace.
          </p>
        </section>

        <p className="mt-10 text-center text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
          Rugged · Trusted · Field Ready
        </p>
        <nav aria-label="Legal documents" className="mt-5 flex items-center justify-center gap-4 text-xs font-semibold text-muted-foreground">
          <Link href="/terms-and-conditions" className="underline underline-offset-4">Terms &amp; Conditions</Link>
          <Link href="/privacy-policy" className="underline underline-offset-4">Privacy Policy</Link>
        </nav>
      </div>
    </main>
  );
}
