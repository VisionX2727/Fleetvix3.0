import { Layout } from "@/components/layout";
import { useStore, WorkLog } from "@/lib/store";
import { useRef, useState } from "react";
import { Plus, ClipboardX, BookOpen, Truck as TruckIcon, Pencil, X, Trash2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRole } from "@/lib/role";

export default function Logs() {
  const { state, dispatch } = useStore();
  const { role, refreshWorkspace } = useRole();
  const [refreshing, setRefreshing] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedLogs, setSelectedLogs] = useState<string[]>([]);
  const [khataCustomerId, setKhataCustomerId] = useState("");
  const [isKhataOpen, setIsKhataOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const suppressClick = useRef(false);
  
  const [formData, setFormData] = useState<Partial<WorkLog>>({
    date: filterDate, vehicleId: "", driverId: "", customerId: "", description: "", hours: 0, trips: 0, diesel: 0, amount: 0, status: "Pending"
  });

  const selectedVehicle = state.vehicles.find((vehicle) => vehicle.id === formData.vehicleId);
  const selectedDriver = state.drivers.find((driver) => driver.id === formData.driverId) || state.drivers[0];
  const tripBasedVehicle = selectedVehicle?.type === "Hywa" || selectedVehicle?.type === "Tipper";
  const khataLogIds = new Set(state.ledgers.map((entry) => entry.logId).filter(Boolean));
  const filteredLogs = state.logs
    .filter(l => !khataLogIds.has(l.id))
    .sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const groupedLogs = Object.entries(
    filteredLogs.reduce<Record<string, WorkLog[]>>((groups, log) => {
      const monthKey = log.date?.slice(0, 7) || "undated";
      groups[monthKey] = [...(groups[monthKey] || []), log];
      return groups;
    }, {}),
  ).sort(([monthA], [monthB]) => monthB.localeCompare(monthA));

  const monthLabel = (monthKey: string) => {
    if (monthKey === "undated") return "Undated";
    const date = new Date(`${monthKey}-01T00:00:00`);
    return Number.isNaN(date.getTime())
      ? monthKey
      : date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const driverId = role === "driver" ? state.drivers[0]?.id || "" : formData.driverId || "";
    if (role === "driver" && !driverId) return;
    if (editingLogId) {
      dispatch({ type: "UPDATE_LOG", payload: { ...formData, driverId, id: editingLogId } });
    } else {
      dispatch({ type: 'ADD_LOG', payload: { ...formData, driverId } });
    }
    setIsAddOpen(false);
    setEditingLogId(null);
    setFormData({ date: filterDate, vehicleId: state.vehicles[0]?.id || "", driverId: state.drivers[0]?.id || "", customerId: "", description: "", hours: 0, trips: 0, diesel: 0, amount: 0, status: "Pending" });
  };

  const openEditLog = (log: WorkLog) => {
    setEditingLogId(log.id);
    setFormData({ ...log });
    setIsAddOpen(true);
  };

  const selectVehicle = (vehicleId: string) => {
    const vehicle = state.vehicles.find((item) => item.id === vehicleId);
    const assignedDriver = state.drivers.find((driver) => driver.type === "Temporary" && driver.vehicleId === vehicleId) || state.drivers.find((driver) => driver.vehicleIds?.includes(vehicleId) || (driver.type !== "Temporary" && driver.vehicleId === vehicleId));
    const tripBased = vehicle?.type === "Hywa" || vehicle?.type === "Tipper";
    setFormData({
      ...formData,
      vehicleId,
      driverId: assignedDriver?.id || formData.driverId || "",
      hours: tripBased ? 0 : formData.hours || 0,
      trips: tripBased ? formData.trips || 0 : 0,
      diesel: tripBased ? formData.diesel || 0 : 0,
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedLogs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const startPress = (id: string) => {
    longPressed.current = false;
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      suppressClick.current = true;
      toggleSelect(id);
    }, 450);
  };

  const endPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const markSelectedPaid = () => {
    selectedLogs.forEach(id => {
      const log = state.logs.find(l => l.id === id);
      if (log) dispatch({ type: 'UPDATE_LOG', payload: { ...log, status: 'Paid' } });
    });
    setSelectedLogs([]);
  };

  const deleteSelected = () => {
    if (confirm(`Delete ${selectedLogs.length} logs?`)) {
      selectedLogs.forEach(id => dispatch({ type: 'DELETE_LOG', payload: id }));
      setSelectedLogs([]);
    }
  };

  const addSelectedToKhata = (e: React.FormEvent) => {
    e.preventDefault();
    if (!khataCustomerId) return;
    selectedLogs.forEach((id) => {
      const log = state.logs.find((item) => item.id === id);
      if (!log || state.ledgers.some((entry) => entry.logId === log.id)) return;
      dispatch({
        type: "ADD_LEDGER",
        payload: {
          customerId: khataCustomerId,
          logId: log.id,
          vehicleId: log.vehicleId,
          date: log.date,
          type: "Charge",
          amount: log.amount,
          description: log.description,
        },
      });
      dispatch({ type: "UPDATE_LOG", payload: { ...log, customerId: khataCustomerId } });
    });
    setSelectedLogs([]);
    setKhataCustomerId("");
    setIsKhataOpen(false);
  };

  const refreshLogs = async () => {
    setRefreshing(true);
    try {
      await refreshWorkspace();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Layout>
      <div className="fm-page-header">
          <h1>Daily Work Entry</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void refreshLogs()} disabled={refreshing} className="fm-icon-button border border-border bg-card text-muted-foreground disabled:opacity-60" aria-label="Refresh logs">
            <RefreshCw size={20} className={refreshing ? "animate-spin" : ""} />
          </button>
        <div className="hidden">
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <button 
                onClick={() => setFormData({ ...formData, date: filterDate, vehicleId: state.vehicles[0]?.id || "", driverId: state.drivers[0]?.id || "" })}
                className="fm-icon-button fm-primary-icon"
              >
                <Plus size={24} strokeWidth={3} />
              </button>
            </DialogTrigger>
            <DialogContent className="w-[90vw] max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">{editingLogId ? "Edit Work Log" : "Add Work Log"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Date</label>
                  <input type="date" value={formData.date || ""} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Vehicle</label>
                  <select value={formData.vehicleId || ""} onChange={e => selectVehicle(e.target.value)} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Select Vehicle</option>
                    {state.vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.regNumber})</option>)}
                  </select>
                </div>
                 {role !== "driver" && <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Driver</label>
                  <select value={formData.driverId || ""} onChange={e => setFormData({...formData, driverId: e.target.value})} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Select Driver</option>
                    {state.drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                 </div>}
                 {role !== "driver" && <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Customer / Site</label>
                  <select value={formData.customerId || ""} onChange={e => setFormData({...formData, customerId: e.target.value || undefined})} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary">
                    <option value="">No customer yet</option>
                    {state.customers.filter(c => !c.completed).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                 </div>}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Description</label>
                  <input value={formData.description || ""} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary" placeholder="Optional work description" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {tripBasedVehicle ? (
                    <>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Trips</label>
                        <input type="number" min="0" step="1" value={formData.trips || ''} onChange={e => setFormData({...formData, trips: Number(e.target.value), hours: 0})} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary" placeholder="0" />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Diesel (L)</label>
                        <input type="number" min="0" step="0.1" value={formData.diesel || ''} onChange={e => setFormData({...formData, diesel: Number(e.target.value), hours: 0})} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary" placeholder="0" />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Hours</label>
                      <input type="number" min="0" step="0.5" value={formData.hours || ''} onChange={e => setFormData({...formData, hours: Number(e.target.value), trips: 0, diesel: 0})} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary" placeholder="0" />
                    </div>
                  )}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Vehicle Work Amount (₹)</label>
                      <input type="number" min="0" value={formData.amount || ''} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary" placeholder="Work / customer amount" />
                      {role === "driver" && <p className="mt-1 text-xs text-muted-foreground">Add the vehicle's actual working amount here. Your driver payment is calculated separately from the Owner-set daily rate.</p>}
                    </div>
                    {role === "driver" && <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm">
                      <strong className="block text-primary">Driver pay: ₹{(selectedDriver?.dailyRate || 0).toLocaleString("en-IN")} per working day</strong>
                      <span className="text-muted-foreground">This is your payment rate, not the vehicle work amount.</span>
                    </div>}
                </div>
                <button type="submit" className="w-full bg-foreground text-background font-bold p-4 rounded-xl mt-4 active:scale-95 transition-transform">
                  {editingLogId ? "Save Changes" : "Save Log"}
                </button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        </div>
      </div>
      <div className="fm-tab-row">
        <button className={`fm-tab ${activeTab === "new" ? "is-active" : ""}`} onClick={() => setActiveTab("new")}>New Entry</button>
         <button className={`fm-tab ${activeTab === "history" ? "is-active" : ""}`} onClick={() => setActiveTab("history")}>Logs Added ({state.logs.filter((log) => !khataLogIds.has(log.id)).length})</button>
      </div>
      {activeTab === "new" && (
        <div className="px-5 pt-6">
          <div className="mb-4 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Select vehicle to add work entry</div>
          {state.vehicles.length === 0 ? (
            <div className="fm-empty-state min-h-48 rounded-[20px] border border-border bg-card">
              <TruckIcon size={48} />
              <p>Add vehicles in Fleet tab first</p>
            </div>
          ) : (
              <div className="fm-stack">{state.vehicles.map((vehicle) => (
               <button key={vehicle.id} type="button" onClick={() => { const assigned = state.drivers.find((driver) => driver.type === "Temporary" && driver.vehicleId === vehicle.id) || state.drivers.find((driver) => driver.vehicleIds?.includes(vehicle.id) || (driver.type !== "Temporary" && driver.vehicleId === vehicle.id)); setFormData({ ...formData, date: filterDate, vehicleId: vehicle.id, driverId: assigned?.id || "", hours: vehicle.type === "Hywa" || vehicle.type === "Tipper" ? 0 : formData.hours || 0, trips: vehicle.type === "Hywa" || vehicle.type === "Tipper" ? 0 : 0, diesel: vehicle.type === "Hywa" || vehicle.type === "Tipper" ? 0 : 0 }); setIsAddOpen(true); }} className="fm-list-row text-left">
                <span><strong>{vehicle.name}</strong><small>{vehicle.type} • {vehicle.regNumber}</small></span><Plus className="text-primary" size={20} />
              </button>
            ))}</div>
          )}
        </div>
      )}
      {activeTab === "history" && (
         <div className="px-5 py-6 pb-24">
        {selectedLogs.length > 0 && (
           <div className="bg-[#1b2d3c] text-white rounded-2xl p-3 mb-4 flex items-center justify-between sticky top-0 z-20 shadow-xl border border-border">
             <div className="flex items-center gap-2"><button type="button" aria-label="Clear selection" onClick={() => setSelectedLogs([])} className="p-1"><X size={22} /></button><span className="font-bold text-base">{selectedLogs.length} selected</span></div>
             <div className="flex gap-2">
               {role !== "driver" && <button onClick={() => setIsKhataOpen(true)} className="bg-black text-white border border-white/20 p-2 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95"><BookOpen size={13} /> Add to Khata</button>}
               <button onClick={deleteSelected} className="border border-destructive/50 bg-destructive/10 text-destructive p-2 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95"><Trash2 size={13} /> Delete</button>
            </div>
          </div>
        )}
        {filteredLogs.length > 0 && selectedLogs.length === 0 && (
          <p className="mb-4 text-xs text-muted-foreground">Long press or double tap a log to select multiple entries.</p>
        )}

         <div className="space-y-6">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border border-dashed">
              <ClipboardX size={48} className="mx-auto text-muted-foreground opacity-30 mb-4" />
              <h3 className="text-lg font-bold">No logs yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Add a work entry to see it here.</p>
            </div>
          ) : (
             groupedLogs.map(([monthKey, monthLogs]) => (
               <section key={monthKey} className="space-y-3">
                 <div className="flex items-center gap-3 px-1">
                   <h3 className="text-xs font-black uppercase tracking-[0.16em] text-primary">{monthLabel(monthKey)}</h3>
                   <div className="h-px flex-1 bg-border" />
                   <span className="text-[10px] font-bold text-muted-foreground">{monthLogs.length} {monthLogs.length === 1 ? "log" : "logs"}</span>
                  </div>
                 <div className="space-y-3">
                 {monthLogs.map(log => {
              const vehicle = state.vehicles.find(v => v.id === log.vehicleId);
              const driver = state.drivers.find(d => d.id === log.driverId);
              const customer = state.customers.find(c => c.id === log.customerId);
              const isSelected = selectedLogs.includes(log.id);

              return (
                  <div
                  key={log.id} 
                   onPointerDown={() => startPress(log.id)}
                   onPointerUp={endPress}
                   onPointerCancel={endPress}
                   onPointerLeave={endPress}
                   onClick={() => {
                     if (suppressClick.current) {
                       suppressClick.current = false;
                       return;
                     }
                     if (selectedLogs.length > 0) toggleSelect(log.id);
                   }}
                   onContextMenu={(event) => event.preventDefault()}
                  className={`bg-card rounded-2xl border p-4 shadow-sm transition-colors ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'}`}
                >
                   <div className="flex justify-between items-start mb-2">
                     <div className={`mr-3 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isSelected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                       {isSelected ? "✓" : ""}
                     </div>
                    <div className="flex-1">
                        <div className="text-xs text-muted-foreground">{log.date}</div>
                       <h4 className="font-bold text-base leading-tight">{log.description || "Work entry"}</h4>
                       <div className="text-xs font-semibold text-muted-foreground mt-1">
                          {vehicle?.name || "Vehicle"} {driver ? `• ${driver.name}` : ""} {vehicle?.type === "Hywa" || vehicle?.type === "Tipper" ? `• ${log.trips || 0} trips • ${log.diesel || 0} L diesel` : `• ${log.hours || 0} hrs`} {customer ? `• ${customer.name}` : ""}
                      </div>
                       {customer && <div className="mt-1 text-xs font-semibold text-primary">{customer.name}</div>}
                    </div>
                    <div className="text-right ml-4">
                      <div className="font-black text-lg">₹{log.amount.toLocaleString()}</div>
                       <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openEditLog(log); }} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-bold text-primary"><Pencil size={11} /> Edit</button>
                    </div>
                  </div>
                </div>
              )
                 })}
                 </div>
               </section>
             ))
          )}
        </div>
        </div>
      )}
      <Dialog open={isKhataOpen} onOpenChange={setIsKhataOpen}>
        <DialogContent className="w-[90vw] max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="text-xl font-bold">Add selected work to Khata</DialogTitle></DialogHeader>
          <form onSubmit={addSelectedToKhata} className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">{selectedLogs.length} selected logs will be added as customer charges.</p>
            <select required value={khataCustomerId} onChange={e => setKhataCustomerId(e.target.value)} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary">
              <option value="" disabled>Select customer</option>
              {state.customers.filter(c => !c.completed).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="submit" className="w-full bg-foreground text-background font-bold p-4 rounded-xl">Add to Customer Khata</button>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
