import { Layout } from "@/components/layout";
import { useStore } from "@/lib/store";
import { useState } from "react";
import { Plus, Wrench } from "lucide-react";

export default function DriverMaintenance() {
  const { state, dispatch } = useStore();
  const [title, setTitle] = useState("");
  const [vehicleId, setVehicleId] = useState(state.vehicles[0]?.id || "");
  const requests = state.maintenanceRequests || [];
  const add = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !vehicleId) return;
    dispatch({ type: "ADD_MAINTENANCE", payload: { title: title.trim(), vehicleId, driverId: state.drivers[0]?.id || "", date: new Date().toISOString().slice(0, 10), status: "Open" } });
    setTitle("");
  };
  return <Layout><header className="fm-page-header"><div><h1>Maintenance</h1><p>Report issues for your vehicles.</p></div></header><main className="fm-page-content space-y-4 pb-24"><form onSubmit={add} className="fm-card space-y-3 p-4"><select required value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className="w-full rounded-xl bg-muted p-3 font-semibold">{state.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Describe the issue" className="w-full rounded-xl bg-muted p-3 font-semibold" /><button type="submit" className="rounded-xl bg-primary p-3 font-bold text-primary-foreground"><Plus className="mr-1 inline" size={17} />Add Request</button></form>{requests.map((request) => <div key={request.id} className="fm-list-row"><div><strong>{request.title}</strong><small>{state.vehicles.find((vehicle) => vehicle.id === request.vehicleId)?.name} • {request.date}</small></div><span className="text-xs font-bold text-amber-300">{request.status}</span></div>)}{!requests.length && <div className="fm-empty-state min-h-40"><Wrench size={42} /><p>No maintenance requests.</p></div>}</main></Layout>;
}