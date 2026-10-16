import { Layout } from "@/components/layout";
import { useStore } from "@/lib/store";
import { CheckCircle2, Wrench } from "lucide-react";

export default function Maintenance() {
  const { state, dispatch } = useStore();
  const requests = state.maintenanceRequests || [];

  return (
    <Layout>
      <header className="fm-page-header">
        <div><h1>Maintenance</h1><p>Requests raised by your drivers</p></div>
      </header>
      <main className="fm-page-content space-y-3 pb-24">
        {requests.length === 0 ? (
          <div className="fm-empty-state min-h-48"><Wrench size={42} /><p>No maintenance requests yet.</p></div>
        ) : requests.slice().reverse().map((request) => {
          const vehicle = state.vehicles.find((item) => item.id === request.vehicleId);
          const driver = state.drivers.find((item) => item.id === request.driverId);
          return (
            <article key={request.id} className="fm-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-black">{request.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{vehicle?.name || "Vehicle"} • {driver?.name || "Driver"} • {request.date}</p>
                  {request.description && <p className="mt-2 text-sm text-muted-foreground">{request.description}</p>}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ${request.status === "Resolved" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{request.status}</span>
              </div>
              {request.status !== "Resolved" && (
                <button type="button" onClick={() => dispatch({ type: "UPDATE_MAINTENANCE", payload: { id: request.id, status: "Resolved" } })} className="mt-3 rounded-xl border border-emerald-400/40 px-3 py-2 text-xs font-black text-emerald-300">
                  <CheckCircle2 size={14} className="mr-1 inline" /> Mark resolved
                </button>
              )}
            </article>
          );
        })}
      </main>
    </Layout>
  );
}