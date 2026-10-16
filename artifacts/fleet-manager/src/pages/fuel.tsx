import { Layout } from "@/components/layout";
import { useStore, FuelRecord } from "@/lib/store";
import { useState } from "react";
import { Plus, Droplet, Calendar, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { useRole } from "@/lib/role";

export default function Fuel() {
  const { state, dispatch } = useStore();
  const { role } = useRole();
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const action = searchParams.get('action');
  
  const [isAddOpen, setIsAddOpen] = useState(action === 'new');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  const [formData, setFormData] = useState<Partial<FuelRecord>>({
    date: filterDate, vehicleId: "", driverId: "", quantity: 0, cost: 0, odometer: 0
  });

  const filteredLogs = state.fuelRecords.filter(f => f.date.startsWith(filterDate.substring(0,7))).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: 'ADD_FUEL', payload: { ...formData, driverId: role === "driver" ? state.drivers[0]?.id || "" : formData.driverId } });
    setIsAddOpen(false);
    if(action === 'new') setLocation('/fuel');
    setFormData({ date: filterDate, vehicleId: "", driverId: "", quantity: 0, cost: 0, odometer: 0 });
  };

  return (
    <Layout>
      <div className="fm-page-header">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h1>Fuel</h1>
            <p>Diesel records by vehicle and date</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if(!open && action === 'new') setLocation('/fuel'); }}>
            <DialogTrigger asChild>
              <button 
                onClick={() => setFormData({ ...formData, date: new Date().toISOString().split('T')[0] })}
                className="fm-icon-button fm-primary-icon"
              >
                <Plus size={24} strokeWidth={3} />
              </button>
            </DialogTrigger>
            <DialogContent className="w-[90vw] max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Add Fuel Record</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Date</label>
                  <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Vehicle</label>
                  <select required value={formData.vehicleId} onChange={e => setFormData({...formData, vehicleId: e.target.value})} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary">
                    <option value="" disabled>Select Vehicle</option>
                    {state.vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.regNumber})</option>)}
                  </select>
                </div>
                {role !== "driver" && <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Filled By (Driver)</label>
                  <select value={formData.driverId || ""} onChange={e => setFormData({...formData, driverId: e.target.value || undefined})} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary">
                    <option value="">No driver / owner</option>
                    {state.drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Liters</label>
                    <input type="number" step="0.1" required value={formData.quantity || ''} onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary" placeholder="50" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Cost (₹)</label>
                    <input type="number" required value={formData.cost || ''} onChange={e => setFormData({...formData, cost: Number(e.target.value)})} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary" placeholder="4500" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Meter/Odometer</label>
                  <input type="number" value={formData.odometer || ''} onChange={e => setFormData({...formData, odometer: Number(e.target.value)})} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary" placeholder="Current meter reading" />
                </div>
                <button type="submit" className="w-full bg-foreground text-background font-bold p-4 rounded-xl mt-4 active:scale-95 transition-transform">
                  Save Record
                </button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="px-6 py-6 pb-24 space-y-4">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl border border-border border-dashed">
            <Droplet size={48} className="mx-auto text-muted-foreground opacity-30 mb-4" />
            <h3 className="text-lg font-bold">No fuel records</h3>
            <p className="text-sm text-muted-foreground mt-1">Track your diesel expenses here.</p>
          </div>
        ) : (
          filteredLogs.map(log => {
            const vehicle = state.vehicles.find(v => v.id === log.vehicleId);
            const driver = state.drivers.find(d => d.id === log.driverId);
            return (
              <div key={log.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-base">{vehicle?.name || 'Unknown'}</h4>
                  <div className="text-xs font-semibold text-muted-foreground mt-0.5">
                    {new Date(log.date).toLocaleDateString()} • {driver?.name}
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground mt-1 bg-muted inline-block px-2 py-0.5 rounded">
                    Meter: {log.odometer}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-lg text-destructive">₹{log.cost.toLocaleString()}</div>
                  <div className="text-xs font-bold text-muted-foreground mt-0.5">{log.quantity} L</div>
                  <button
                    type="button"
                    aria-label={`Delete fuel record for ${vehicle?.name || "vehicle"}`}
                    onClick={() => {
                      if (window.confirm("Delete this fuel record?")) dispatch({ type: "DELETE_FUEL", payload: log.id });
                    }}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg border border-rose-400/40 px-2 py-1 text-[11px] font-bold text-rose-300"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </Layout>
  );
}
