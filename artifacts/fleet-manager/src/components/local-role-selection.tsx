import { ArrowRight, Truck, WalletCards } from "lucide-react";
import fleetXLogo from "@assets/FleetX_1785676635299.jpeg";

type LocalRole = "owner" | "driver";

export default function LocalRoleSelection({
  onSelect,
}: {
  onSelect: (role: LocalRole) => void;
}) {
  return (
    <main className="min-h-[100dvh] bg-background px-5 py-10 text-foreground">
      <div className="mx-auto flex min-h-[80dvh] w-full max-w-md flex-col justify-center">
        <header className="mb-8 text-center">
          <img src={fleetXLogo} alt="Fleetvix" className="fm-login-logo mx-auto" />
          <p className="mt-5 text-xs font-black uppercase tracking-[0.24em] text-primary">
            Fleetvix
          </p>
          <h1 className="mt-2 text-3xl font-black">Choose your workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Select how you use Fleetvix to continue.
          </p>
        </header>

        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => onSelect("owner")}
            className="group flex items-center gap-4 rounded-2xl border border-primary/30 bg-primary p-5 text-left text-primary-foreground shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/15">
              <WalletCards size={24} />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-xl">Owner</strong>
              <span className="mt-1 block text-sm font-medium opacity-85">
                Manage vehicles, drivers, customers and reports.
              </span>
            </span>
            <ArrowRight size={20} className="shrink-0 transition-transform group-hover:translate-x-1" />
          </button>

          <button
            type="button"
            onClick={() => onSelect("driver")}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-md transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Truck size={24} />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-xl">Driver</strong>
              <span className="mt-1 block text-sm font-medium text-muted-foreground">
                Open driver tools for work logs, fuel and payments.
              </span>
            </span>
            <ArrowRight size={20} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Local workspace · Records stay in this browser and do not sync across devices.
        </p>
      </div>
    </main>
  );
}
