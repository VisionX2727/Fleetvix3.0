import { useStore } from "@/lib/store";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { useState } from "react";
import { ArrowDownRight, BarChart3, ChevronDown, ClipboardList, Droplet, ExternalLink, FileText, Plus, Radio, Truck, Wrench, Calculator, Settings, UserCircle } from "lucide-react";

const trackingPortals = [
  {
    name: "WheelsEye",
    description: "Vehicle GPS tracking",
    url: "https://wheelseye.com/fo/login",
  },
  {
    name: "JCB LiveLink",
    description: "JCB machine location and telematics",
    url: "https://app.jcblivelink.com/",
  },
];

export default function Home() {
  const { state } = useStore();
  const [showTrackingPortals, setShowTrackingPortals] = useState(false);
  const today = new Date().toISOString().split("T")[0];
  const todayLogs = state.logs.filter((log) => log.date === today);
  const revenue = todayLogs.reduce((sum, log) => sum + log.amount, 0) + state.fleetDays.filter((day) => day.date === today).reduce((sum, day) => sum + day.amount, 0);
  const expenses = state.fuelRecords.filter((fuel) => fuel.date === today).reduce((sum, fuel) => sum + fuel.cost, 0);
  const active = state.vehicles.filter((vehicle) => vehicle.status === "Active").length;
  const idle = state.vehicles.filter((vehicle) => vehicle.status === "Idle").length;
  const maintenance = state.vehicles.filter((vehicle) => vehicle.status === "Maintenance").length;

  return (
    <Layout>
      <header className="fm-home-header">
        <div className="fm-home-brand">
           {state.settings.logoUrl ? <img src={state.settings.logoUrl} alt="Business logo" /> : <div className="fm-home-logo"><UserCircle size={30} /></div>}
          <div>
            <div className="fm-home-greeting">{new Date().getHours() < 12 ? "Good Morning" : new Date().getHours() < 17 ? "Good Afternoon" : "Good Evening"}</div>
            <div className="fm-home-title">{state.settings.companyName || state.settings.businessName || "Fleetvix"}</div>
          </div>
        </div>
        <div className="fm-home-header-actions">
          <Link href="/calculator"><Calculator size={21} /></Link>
          <Link href="/settings"><Settings size={22} /></Link>
        </div>
      </header>
      <div className="border-b border-border bg-[#1b2d3c] px-5 py-3 text-sm text-muted-foreground">
        {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} • {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
      </div>
      <main className="fm-page-content space-y-5">
        <section className="fm-overview">
          <div className="fm-section-heading"><h2>Today's Business Overview</h2><span className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-IN")}</span></div>
          <div className="fm-overview-grid">
            <div className="fm-overview-stat"><BarChart3 className="text-emerald-400" size={22} /><strong>₹{revenue.toLocaleString("en-IN")}</strong><span>Revenue</span></div>
            <div className="fm-overview-stat"><ArrowDownRight className="text-rose-400" size={22} /><strong>₹{expenses.toLocaleString("en-IN")}</strong><span>Expenses</span></div>
            <div className="fm-overview-stat"><BarChart3 className="text-primary" size={22} /><strong>₹{(revenue - expenses).toLocaleString("en-IN")}</strong><span>Net Profit</span></div>
          </div>
        </section>

        <section>
           <div className="fm-section-heading"><h2>Live Fleet Status</h2></div>
          <div className="fm-card p-4">
            {state.vehicles.length === 0 ? <div className="fm-empty-state min-h-32"><Truck size={40} /><p>No vehicles. Tap to add in Fleet.</p></div> : <div className="grid grid-cols-3 gap-2 text-center"><div><strong className="block text-2xl font-black text-emerald-400">{active}</strong><span className="text-xs text-muted-foreground">Active</span></div><div><strong className="block text-2xl font-black text-amber-300">{idle}</strong><span className="text-xs text-muted-foreground">Idle</span></div><div><strong className="block text-2xl font-black text-rose-300">{maintenance}</strong><span className="text-xs text-muted-foreground">Maintenance</span></div></div>}
          </div>
        </section>

        <section aria-label="Live vehicle tracking">
          <button
            type="button"
            aria-expanded={showTrackingPortals}
            aria-controls="live-monitoring-portals"
            onClick={() => setShowTrackingPortals((current) => !current)}
            className="flex w-full items-center gap-3 rounded-2xl border border-violet-300/30 bg-gradient-to-r from-violet-700 to-purple-600 p-4 text-left text-white shadow-lg shadow-violet-950/20 transition hover:from-violet-600 hover:to-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Radio size={23} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-black">Live Monitoring</span>
              <span className="mt-0.5 block text-xs text-violet-100">Open a vehicle tracking provider</span>
            </span>
            <ChevronDown
              size={21}
              aria-hidden="true"
              className={`shrink-0 transition-transform ${showTrackingPortals ? "rotate-180" : ""}`}
            />
          </button>

          <div
            id="live-monitoring-portals"
            role="region"
            aria-label="Live monitoring providers"
            aria-hidden={!showTrackingPortals}
            className={`mt-3 grid gap-2 sm:grid-cols-2 ${showTrackingPortals ? "" : "hidden"}`}
          >
            {trackingPortals.map((portal) => (
              <a
                key={portal.name}
                href={portal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="fm-card flex items-center gap-3 border border-violet-400/20 p-3 transition hover:border-violet-400/60 hover:bg-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                  <Truck size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-foreground">{portal.name}</span>
                  <span className="block text-xs text-muted-foreground">{portal.description}</span>
                </span>
                <ExternalLink size={17} aria-hidden="true" className="shrink-0 text-violet-300" />
              </a>
            ))}
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Provider sign-in opens in a new tab. Your tracking account is managed by the provider.
            </p>
          </div>
        </section>

        <section>
          <div className="fm-section-heading"><h2>Quick Actions</h2></div>
          <div className="fm-quick-grid">
            <Link href="/logs?action=new" className="fm-quick-action"><ClipboardList size={27} /> New Entry</Link>
            <Link href="/fuel?action=new" className="fm-quick-action"><Droplet size={27} /> Add Fuel</Link>
            <Link href="/maintenance" className="fm-quick-action"><Wrench size={27} /> Maintenance</Link>
            <Link href="/analytics" className="fm-quick-action"><BarChart3 size={27} /> Reports</Link>
            <Link href="/notes" className="fm-quick-action"><FileText size={27} /> Notes</Link>
          </div>
        </section>

        <section className="pb-4">
          <div className="fm-section-heading"><h2>Recent Logs</h2><Link href="/logs">View all</Link></div>
           {todayLogs.length === 0 ? <div className="fm-card p-6 text-center text-sm text-muted-foreground">No logs added today.</div> : <div className="fm-stack">{todayLogs.slice().reverse().slice(0, 3).map((log) => <div className="fm-list-row" key={log.id}><div><strong>{state.vehicles.find((vehicle) => vehicle.id === log.vehicleId)?.name || "Vehicle"}</strong><small>{log.description} • {log.hours} hrs</small></div><div className="fm-list-value text-primary">₹{log.amount.toLocaleString("en-IN")}</div></div>)}</div>}
        </section>
      </main>
      <Link href="/logs?action=new" className="fm-fab" aria-label="Add work entry"><Plus size={30} /></Link>
    </Layout>
  );
}