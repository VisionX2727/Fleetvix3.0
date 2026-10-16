import { Layout } from "@/components/layout";
import { useStore, Driver } from "@/lib/store";
import { useEffect, useState } from "react";
import { Plus, Users, IndianRupee, History, CheckCircle2, CalendarDays, UserCheck, UserX, ArrowLeft, UserRoundPlus, Pencil, Trash2, Phone, Ban, RotateCcw, UserMinus, FileUp, Send, Download, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link, useLocation } from "wouter";
import { useRole } from "@/lib/role";
import { useAuth } from "@/lib/auth";
import { createInvoiceHtml } from "@/lib/invoice";
import { createHtmlPdf } from "@/lib/pdf";
import { revokeDriverInvoice, sendDriverInvoice, type DriverDocument } from "@/lib/workspace";

export default function Drivers() {
  const { state, dispatch } = useStore();
  const { members = [], invoices = [], addInvoice, removeInvoice, updateOwnerMemberStatus, updateOwnerMemberRate, deleteOwnerMember, sendOwnerFile } = useRole();
  const { session } = useAuth();
  const [location] = useLocation();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [payDriverId, setPayDriverId] = useState<string | null>(null);
  const [historyDriverId, setHistoryDriverId] = useState<string | null>(null);
  const [detailDriverId, setDetailDriverId] = useState<string | null>(null);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [activeType, setActiveType] = useState<Driver["type"]>("Regular");
  const [invoiceMemberId, setInvoiceMemberId] = useState("");
  const [invoiceTitle, setInvoiceTitle] = useState("Fleetvix Driver Receipt");
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [memberBusy, setMemberBusy] = useState<string | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [filesHistoryOpen, setFilesHistoryOpen] = useState(false);
  const [rateDraft, setRateDraft] = useState(0);
  const [rateBusy, setRateBusy] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Driver>>({
    name: "", phone: "", type: "Regular", dailyRate: 0, vehicleId: "", startDate: new Date().toISOString().split("T")[0], endDate: ""
  });

  const openDriverDetail = (driverId: string) => {
    const driver = state.drivers.find((item) => item.id === driverId);
    setRateDraft(driver?.dailyRate || 0);
    setDetailDriverId(driverId);
  };

  useEffect(() => {
    const query = location.includes("?") ? location.slice(location.indexOf("?") + 1) : "";
    const driverId = new URLSearchParams(query).get("driverId");
    if (driverId) openDriverDetail(driverId);
  }, [location]);

  const saveJoinedDriverRate = async (memberId: string) => {
    setRateBusy(true);
    try {
      const nextState = await updateOwnerMemberRate(memberId, Math.max(0, Number(rateDraft) || 0));
      const updatedDriver = nextState.drivers.find((driver) => driver.id === memberId);
      if (updatedDriver) dispatch({ type: "UPDATE_DRIVER", payload: updatedDriver });
    } finally {
      setRateBusy(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDriverId) {
      dispatch({ type: "UPDATE_DRIVER", payload: { ...formData, id: editingDriverId } });
    } else {
      dispatch({ type: 'ADD_DRIVER', payload: formData });
    }
    setIsAddOpen(false);
    setEditingDriverId(null);
    setFormData({ name: "", phone: "", type: "Regular", dailyRate: 0, vehicleId: "", startDate: new Date().toISOString().split("T")[0], endDate: "" });
  };

  const openEditDriver = (driver: Driver) => {
    setEditingDriverId(driver.id);
    setFormData({ ...driver });
    setIsAddOpen(true);
  };

  const deleteDriver = (driver: Driver) => {
    if (!window.confirm(`Delete ${driver.name}? Their work logs, fuel records, notes and payment history will also be deleted.`)) return;
    dispatch({ type: "DELETE_DRIVER", payload: driver.id });
    if (payDriverId === driver.id) setPayDriverId(null);
    if (historyDriverId === driver.id) setHistoryDriverId(null);
    if (detailDriverId === driver.id) setDetailDriverId(null);
  };

  const setMemberStatus = async (member: typeof members[number], status: "Active" | "Blocked" | "Removed") => {
    setMemberBusy(member.id);
    try {
      await updateOwnerMemberStatus(member.id, status);
      dispatch({ type: "UPDATE_DRIVER", payload: { id: member.id, status } });
    } finally {
      setMemberBusy(null);
    }
  };

  const removeMemberPermanently = async (member: typeof members[number]) => {
    if (!window.confirm(`Delete ${member.profile.name || "this driver"} permanently? This removes only this driver's Fleetvix records.`)) return;
    setMemberBusy(member.id);
    try {
      await deleteOwnerMember(member.id);
      dispatch({ type: "DELETE_DRIVER", payload: member.id });
    } finally {
      setMemberBusy(null);
    }
  };

  const sendFileToMember = (member: typeof members[number], event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const payload: DriverDocument = { id: `${Date.now()}`, name: file.name, type: file.type, dataUrl: String(reader.result), uploadedAt: new Date().toISOString().slice(0, 10) };
      void sendOwnerFile(member.id, payload);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };
  const memberForDriver = (driverId: string) => members.find((member) => member.id === driverId);
  const downloadDriverReport = async (driver: Driver) => {
    const logs = driverLogs(driver.id);
    const pays = state.driverPays.filter((pay) => pay.driverId === driver.id);
    const absentDates = state.logs.filter((log) => driver.vehicleId && log.vehicleId === driver.vehicleId && log.driverId !== driver.id).map((log) => log.date).filter((date, index, dates) => dates.indexOf(date) === index);
    const rows = logs.map((log) => `<tr><td>${log.date}</td><td>${state.vehicles.find((vehicle) => vehicle.id === log.vehicleId)?.name || "Vehicle"}</td><td>${log.description || "Work entry"}</td><td>₹${(log.driverDailyRate ?? driver.dailyRate ?? 0).toLocaleString("en-IN")}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#eef1f4;font:13px Arial;color:#18202b}.sheet{width:794px;min-height:1123px;background:#fff;padding:36px}.brand{border-bottom:4px solid #f5b91d;padding-bottom:18px}.brand h1{margin:0;font-size:28px}h2{font-size:17px;border-bottom:1px solid #d7dde5;padding-bottom:7px;margin-top:24px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.card{border:1px solid #d7dde5;border-radius:10px;padding:12px}.card b{display:block;font-size:19px;margin-top:5px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d7dde5;padding:8px;text-align:left}th{background:#f4f6f8}td:last-child,th:last-child{text-align:right}</style></head><body><main class="sheet"><header class="brand"><h1>${state.settings.companyName || state.settings.businessName || "Fleetvix"} — Driver Report</h1><p>${driver.name} • ${driver.phone} • ${driver.type}</p></header><section class="grid"><div class="card">Working days<b>${new Set(logs.map((log) => log.date)).size}</b></div><div class="card">Paid<b>₹${pays.reduce((sum, pay) => sum + pay.amount, 0).toLocaleString("en-IN")}</b></div><div class="card">Daily rate<b>₹${driver.dailyRate.toLocaleString("en-IN")}</b></div></section><h2>Work Logs</h2><table><thead><tr><th>Date</th><th>Vehicle</th><th>Description</th><th>Amount</th></tr></thead><tbody>${rows || "<tr><td colspan='4'>No work logs</td></tr>"}</tbody></table><h2>Paid History</h2><p>${pays.map((pay) => `${pay.date} — ₹${pay.amount.toLocaleString("en-IN")} — ${pay.description || "Driver payment"}`).join("<br>") || "No paid history"}</p><h2>Absent Days</h2><p>${absentDates.join(", ") || "No absent days"}</p></main></body></html>`;
    const blob = await createHtmlPdf(html);
    const file = new File([blob], `${driver.name.replace(/\W+/g, "-").toLowerCase()}-report.pdf`, { type: "application/pdf" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const driverLogs = (driverId: string) => state.logs.filter((log) => log.driverId === driverId).sort((a, b) => b.date.localeCompare(a.date));
  const assignedVehicles = (driver: Driver) => {
    const ids = new Set([...(driver.vehicleIds || []), ...(driver.vehicleId ? [driver.vehicleId] : [])]);
    return state.vehicles.filter((vehicle) => ids.has(vehicle.id));
  };
  const unpaidDriverLogs = (driverId: string) => driverLogs(driverId).filter((log) => !state.driverPays.some((pay) => pay.driverId === driverId && pay.logIds?.includes(log.id)));
  const driverEarned = (driverId: string) => unpaidDriverLogs(driverId).reduce((sum, log) => {
    const driver = state.drivers.find((item) => item.id === driverId);
    return sum + (log.driverDailyRate ?? driver?.dailyRate ?? 0);
  }, 0);
  const driverPaid = (driverId: string) => state.driverPays.filter((pay) => pay.driverId === driverId).reduce((sum, pay) => sum + pay.amount, 0);

  const sendInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    const target = members.find((member) => member.driverUserId === invoiceMemberId);
    if (!target || !session) return;
    setInvoiceBusy(true);
    try {
      const driverLogs = state.logs.filter((log) => log.driverId === target.id);
      const driver = state.drivers.find((item) => item.id === target.id);
      const total = driverLogs.reduce((sum, log) => sum + (log.driverDailyRate ?? driver?.dailyRate ?? 0), 0);
      const today = new Date().toISOString().split("T")[0];
      const html = createInvoiceHtml({
        invoiceId: `DRV-${today}-${target.id.slice(-6)}`,
        issuedAt: today,
        issuedTime: new Date().toLocaleTimeString("en-IN"),
        businessName: state.settings.businessName,
        companyName: state.settings.companyName || state.settings.businessName,
        ownerName: state.settings.ownerName || "",
        phone: state.settings.phone || "",
        email: state.settings.email || "",
        address: state.settings.address || "",
        bankName: state.settings.bankName || "",
        gstNumber: state.settings.gstNumber || "",
        upiId: state.settings.upiId || "",
        logoUrl: state.settings.logoUrl,
        customerName: target.profile.name,
        customerPhone: target.profile.phone,
        customerCompany: "Driver payment",
        customerAddress: target.profile.address || "",
        workStart: driverLogs.at(-1)?.date || today,
        workEnd: driverLogs[0]?.date || today,
        serviceLocation: state.settings.companyName || state.settings.businessName,
        lines: driverLogs.map((log) => ({ date: log.date, description: log.description || "Work entry", amount: log.driverDailyRate ?? driver?.dailyRate ?? 0 })),
        total,
        balanceDue: total,
        status: "PENDING",
      });
      const result = await sendDriverInvoice(session.access_token, target.driverUserId, invoiceTitle || "Fleetvix Driver Receipt", html);
      addInvoice(result.invoice);
      setInvoiceMemberId("");
    } finally {
      setInvoiceBusy(false);
    }
  };

  const revokeInvoice = async (invoiceId: string) => {
    if (!session) return;
    await revokeDriverInvoice(session.access_token, invoiceId);
    removeInvoice(invoiceId);
  };

  return (
    <Layout>
      <div className="fm-page-header">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-muted-foreground"><ArrowLeft size={22} /></Link>
          <div><h1>Drivers</h1></div>
        </div>
        <div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <button onClick={() => setFormData({ ...formData, type: activeType })} className="fm-icon-button fm-primary-icon">
                <Plus size={24} strokeWidth={3} />
              </button>
            </DialogTrigger>
            <DialogContent className="w-[90vw] max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">{editingDriverId ? "Edit Driver" : "Add Driver"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Name</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary" placeholder="e.g. Ramesh" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Phone</label>
                  <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary" placeholder="10 digit number" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Type</label>
                    <select required value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary">
                      <option value="Regular">Regular</option>
                      <option value="Temporary">Temporary</option>
                    </select>
                  </div>
                {formData.type === "Temporary" && <div className="col-span-2 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Start Date</label>
                    <input type="date" value={formData.startDate || ""} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">End Date</label>
                    <input type="date" value={formData.endDate || ""} onChange={e => setFormData({...formData, endDate: e.target.value})} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Daily Rate (₹)</label>
                     <input type="number" required value={formData.dailyRate || ''} onChange={e => setFormData({...formData, dailyRate: Number(e.target.value)})} className="w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary" placeholder="1000" />
                     <p className="mt-1 text-xs text-muted-foreground">Only new work logs use a changed rate. Existing logs keep their saved rate.</p>
                  </div>
                </div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Owner vehicle assignment (temporary override)<select value={formData.vehicleId || ""} onChange={e => setFormData({ ...formData, vehicleId: e.target.value || undefined })} className="mt-1 w-full bg-muted border-none rounded-xl p-4 font-semibold outline-none"><option value="">No temporary assignment</option>{state.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} ({vehicle.regNumber})</option>)}</select></label>
                <button type="submit" className="w-full bg-foreground text-background font-bold p-4 rounded-xl mt-4 active:scale-95 transition-transform">
                  {editingDriverId ? "Save Changes" : "Save Driver"}
                </button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
       <section className="mx-5 mt-4 space-y-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
         <div><h2 className="font-black">Vehicle access codes</h2><p className="text-xs text-muted-foreground">Share a vehicle’s code with its driver. Generate or regenerate codes from the Fleet page.</p></div>
         <div className="space-y-2">
           {state.vehicles.map((vehicle) => <div key={vehicle.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"><span className="min-w-0"><strong className="block truncate">{vehicle.name}</strong><span className="text-xs text-muted-foreground">{vehicle.regNumber}</span></span><button type="button" disabled={!vehicle.accessCode} onClick={() => void navigator.clipboard?.writeText(vehicle.accessCode || "")} className="flex shrink-0 items-center gap-1 rounded-lg bg-primary/15 px-2.5 py-2 font-mono text-xs font-black tracking-wider text-primary disabled:opacity-50">{vehicle.accessCode || "Not generated"}{vehicle.accessCode && <Copy size={13} />}</button></div>)}
           {!state.vehicles.length && <p className="text-sm text-muted-foreground">Add a vehicle first, then generate its code from Fleet.</p>}
         </div>
        {members.length > 0 ? <div className="space-y-2">
           {members.map((member) => <button type="button" key={member.id} onClick={() => openDriverDetail(member.id)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-left active:bg-muted">
             <span className="min-w-0"><strong className="block truncate">{member.profile.name || "Driver"}</strong><span className="text-xs text-muted-foreground">{member.profile.phone} • {member.profile.vehicleIds.length} vehicle(s){member.profile.vehicleIds.length > 0 ? ` • ${member.profile.vehicleIds.map((id) => state.vehicles.find((vehicle) => vehicle.id === id)?.name || "Vehicle").join(", ")}` : ""}</span></span>
            <span className={`shrink-0 text-xs font-bold ${member.profile.status === "Blocked" ? "text-amber-300" : member.profile.status === "Removed" ? "text-rose-300" : "text-emerald-400"}`}>{member.profile.status || "Active"} <span className="ml-1 text-muted-foreground">›</span></span>
          </button>)}
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">Open a driver to send invoices and files or review sent-file history.</p>
        </div> : <p className="text-sm text-muted-foreground">No joined drivers yet.</p>}
      </section>
      <div className="fm-tab-row">
        <button className={`fm-tab ${activeType === "Regular" ? "is-active" : ""}`} onClick={() => setActiveType("Regular")}>Regular ({state.drivers.filter((driver) => driver.type === "Regular").length})</button>
        <button className={`fm-tab ${activeType === "Temporary" ? "is-active" : ""}`} onClick={() => setActiveType("Temporary")}>Temporary ({state.drivers.filter((driver) => driver.type === "Temporary").length})</button>
      </div>

      <div className="px-5 py-6 space-y-4">
        {state.drivers.filter((driver) => driver.type === activeType).length === 0 ? (
          <div className="fm-driver-empty">
            <UserRoundPlus size={52} />
            <h3>No {activeType} Drivers</h3>
            <p>Add drivers to track daily work and payment history</p>
            <button type="button" onClick={() => { setFormData({ ...formData, type: activeType }); setIsAddOpen(true); }} className="fm-primary-button"><UserRoundPlus size={18} /> Add {activeType} Driver</button>
          </div>
        ) : (
          state.drivers.filter((driver) => driver.type === activeType).map(driver => (
             <button type="button" key={driver.id} onClick={() => openDriverDetail(driver.id)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm active:bg-muted">
               <span className="min-w-0"><strong className="block truncate text-lg">{driver.name}</strong><span className="mt-1 block truncate text-sm font-semibold text-muted-foreground">{driver.phone}{assignedVehicles(driver).length ? ` • ${assignedVehicles(driver).map((vehicle) => vehicle.name).join(", ")}` : " • No vehicle assigned"}</span></span>
              <span className="shrink-0 text-right"><span className="block text-sm font-black text-primary">₹{driver.dailyRate.toLocaleString("en-IN")}/day</span><span className="text-xs font-bold uppercase text-muted-foreground">{driver.status || "Active"} <span className="ml-1">›</span></span></span>
            </button>
          ))
        )}
      </div>
      <Dialog open={Boolean(payDriverId)} onOpenChange={(open) => !open && setPayDriverId(null)}>
        <DialogContent className="w-[90vw] max-w-md rounded-2xl">
          {payDriverId && (() => {
            const driver = state.drivers.find((item) => item.id === payDriverId);
            if (!driver) return null;
             const outstanding = driverEarned(driver.id);
            return <><DialogHeader><DialogTitle className="text-xl font-bold">Pay {driver.name}</DialogTitle></DialogHeader><div className="rounded-xl bg-primary/10 p-4 my-3"><div className="text-xs font-bold uppercase text-muted-foreground">Outstanding work</div><div className="text-3xl font-black">₹{outstanding.toLocaleString()}</div><div className="text-xs text-muted-foreground mt-1">{unpaidDriverLogs(driver.id).length} unpaid work days will move to history</div></div><form onSubmit={(event) => { event.preventDefault(); dispatch({ type: "ADD_DRIVER_PAY", payload: { driverId: driver.id, date: new Date().toISOString().split("T")[0], amount: payAmount, logIds: unpaidDriverLogs(driver.id).map((log) => log.id), description: "Driver payment" } }); setPayDriverId(null); }} className="space-y-4"><input type="number" min="0" required value={payAmount || ""} onChange={(event) => setPayAmount(Number(event.target.value))} className="w-full bg-muted rounded-xl p-4 font-semibold outline-none focus:ring-2 focus:ring-primary" placeholder="Amount paid" /><button type="submit" className="w-full bg-foreground text-background font-bold p-4 rounded-xl">Mark as Paid</button></form></>;
          })()}
      </DialogContent>
      </Dialog>
      <Dialog open={Boolean(detailDriverId)} onOpenChange={(open) => !open && setDetailDriverId(null)}>
        <DialogContent className="fm-dialog">
          {detailDriverId && (() => {
             const driver = state.drivers.find((item) => item.id === detailDriverId);
             const member = members.find((item) => item.id === detailDriverId);
             if (!driver && !member) return null;
             const displayDriver = driver || { id: detailDriverId, name: member?.profile.name || "Driver", phone: member?.profile.phone || "", type: "Regular" as const, dailyRate: 0, vehicleIds: member?.profile.vehicleIds || [], status: member?.profile.status };
             if (!displayDriver) return null;
              const allLogs = driver ? driverLogs(driver.id) : [];
              const logs = driver ? unpaidDriverLogs(driver.id) : [];
             const assignedDates = new Set(allLogs.map((log) => log.date));
              const vehicles = driver ? assignedVehicles(driver) : (member?.profile.vehicleIds || []).map((id) => state.vehicles.find((item) => item.id === id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
              const vehicle = driver?.vehicleId ? state.vehicles.find((item) => item.id === driver.vehicleId) : vehicles[0];
             const absentDates = state.logs.filter((log) => vehicle && log.vehicleId === vehicle.id && log.driverId !== displayDriver.id).map((log) => log.date).filter((date, index, dates) => dates.indexOf(date) === index);
            return (
              <>
                 <DialogHeader><DialogTitle>{displayDriver.name}</DialogTitle></DialogHeader>
                 <div className="mb-4 flex flex-wrap gap-2">
                   <a href={`tel:${displayDriver.phone}`} className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300"><Phone size={13} className="mr-1 inline" />Call</a>
                    {driver && <><button type="button" onClick={() => openEditDriver(driver)} className="rounded-lg bg-primary/15 px-3 py-2 text-xs font-bold text-primary"><Pencil size={13} className="mr-1 inline" />Edit</button><button type="button" onClick={() => { setPayDriverId(driver.id); setPayAmount(driverEarned(driver.id)); }} className="rounded-lg bg-primary/15 px-3 py-2 text-xs font-bold text-primary"><IndianRupee size={13} className="mr-1 inline" />Pay</button><button type="button" onClick={() => void downloadDriverReport(driver)} className="rounded-lg bg-primary/15 px-3 py-2 text-xs font-bold text-primary"><Download size={13} className="mr-1 inline" />Report</button><button type="button" onClick={() => setHistoryDriverId(driver.id)} className="rounded-lg bg-muted px-3 py-2 text-xs font-bold"><History size={13} className="mr-1 inline" />Payments</button>{!member && <button type="button" onClick={() => deleteDriver(driver)} className="rounded-lg border border-rose-400/40 px-3 py-2 text-xs font-bold text-rose-300"><Trash2 size={13} className="mr-1 inline" />Delete</button>}</>}
                    {member && <><button type="button" onClick={() => { setInvoiceMemberId(member.driverUserId); setSendDialogOpen(true); }} className="rounded-lg bg-primary/15 px-3 py-2 text-xs font-bold text-primary"><Send size={13} className="mr-1 inline" />Send invoices &amp; files</button><button type="button" onClick={() => setFilesHistoryOpen(true)} className="rounded-lg bg-muted px-3 py-2 text-xs font-bold"><History size={13} className="mr-1 inline" />Files history</button>{member.profile.status === "Blocked" ? <button type="button" disabled={memberBusy === member.id} onClick={() => void setMemberStatus(member, "Active")} className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300"><RotateCcw size={13} className="mr-1 inline" />Unblock</button> : member.profile.status !== "Removed" && <button type="button" disabled={memberBusy === member.id} onClick={() => void setMemberStatus(member, "Blocked")} className="rounded-lg bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-300"><Ban size={13} className="mr-1 inline" />Block</button>}{member.profile.status !== "Removed" && <button type="button" disabled={memberBusy === member.id} onClick={() => void setMemberStatus(member, "Removed")} className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-300"><UserMinus size={13} className="mr-1 inline" />Remove</button>}<button type="button" disabled={memberBusy === member.id} onClick={() => void removeMemberPermanently(member)} className="rounded-lg border border-rose-400/30 px-3 py-2 text-xs font-bold text-rose-300"><Trash2 size={13} className="mr-1 inline" />Delete driver</button></>}
                 </div>
                  {member && <div className="mb-4 rounded-xl bg-muted p-3 text-sm"><strong>{member.profile.status || "Active"}</strong><span className="ml-2 text-muted-foreground">{member.profile.vehicleIds.length} assigned vehicle(s)</span>{vehicles.length > 0 && <div className="mt-2 text-xs font-bold text-primary">Vehicles: {vehicles.map((item) => item.name).join(", ")}</div>}{member.profile.documents.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{member.profile.documents.map((document) => <a key={document.id} href={document.dataUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-card px-2 py-1 text-xs font-bold text-primary">{document.name}</a>)}</div>}<form className="mt-3 flex items-end gap-2 border-t border-border pt-3" onSubmit={(event) => { event.preventDefault(); void saveJoinedDriverRate(member.id); }}><label className="min-w-0 flex-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Daily rate (₹)<input type="number" min="0" value={rateDraft || ""} onChange={(event) => setRateDraft(Number(event.target.value))} className="mt-1 w-full rounded-lg bg-card p-2 text-sm font-black text-foreground outline-none" /></label><button type="submit" disabled={rateBusy} className="rounded-lg bg-primary px-3 py-2 text-xs font-black text-primary-foreground">{rateBusy ? "Saving…" : "Save rate"}</button></form></div>}
                 <div className="fm-kpi-grid"><div><span>Worked days</span><strong>{assignedDates.size}</strong></div><div><span>Earned</span><strong>₹{driver ? driverEarned(driver.id).toLocaleString("en-IN") : "0"}</strong></div><div><span>Paid</span><strong>₹{driver ? driverPaid(driver.id).toLocaleString("en-IN") : "0"}</strong></div></div>
                <div className="fm-stack">
                  {allLogs.length === 0 && absentDates.length === 0 && <p className="fm-muted">No work history yet.</p>}
                   {allLogs.map((log) => <div className="fm-list-row" key={log.id}><div><strong>{log.date} • {state.vehicles.find((item) => item.id === log.vehicleId)?.name || "Vehicle"}</strong><small>{log.description} • {state.vehicles.find((item) => item.id === log.vehicleId)?.type === "Hywa" || state.vehicles.find((item) => item.id === log.vehicleId)?.type === "Tipper" ? `${log.trips || 0} trips` : `${log.hours || 0} hours`} • Work ₹{log.amount.toLocaleString("en-IN")}{state.driverPays.some((pay) => pay.logIds?.includes(log.id)) ? " • Paid" : ""}</small></div><div className="fm-list-value text-primary">₹{(log.driverDailyRate ?? displayDriver.dailyRate).toLocaleString("en-IN")}</div></div>)}
                  {absentDates.map((date) => <div className="fm-list-row" key={`absent-${date}`}><div><strong>{date}</strong><small>{vehicle?.name || "Assigned vehicle"} • another driver selected</small></div><div className="flex items-center gap-1 text-xs font-black text-rose-300"><UserX size={14} /> Absent</div></div>)}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="w-[90vw] max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>Send invoices &amp; files</DialogTitle></DialogHeader>
          {(() => {
            const target = members.find((member) => member.driverUserId === invoiceMemberId);
            if (!target) return <p className="text-sm text-muted-foreground">Select a driver first.</p>;
            return (
              <div className="space-y-4 pt-3">
                <form onSubmit={async (event) => { await sendInvoice(event); setSendDialogOpen(false); }} className="space-y-3">
                  <p className="text-sm text-muted-foreground">Create a driver invoice for {target.profile.name || "this driver"}.</p>
                  <input value={invoiceTitle} onChange={(event) => setInvoiceTitle(event.target.value)} className="w-full rounded-xl bg-muted p-3 font-semibold" placeholder="Invoice title" />
                  <button disabled={invoiceBusy} type="submit" className="w-full rounded-xl bg-primary p-3 font-black text-primary-foreground">{invoiceBusy ? "Sending..." : "Send Invoice"}</button>
                </form>
                <div className="border-t border-border pt-3">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm font-bold text-primary">
                    <FileUp size={17} /> Choose file to send
                    <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="sr-only" onChange={(event) => { sendFileToMember(target, event); setSendDialogOpen(false); }} />
                  </label>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
      <Dialog open={filesHistoryOpen} onOpenChange={setFilesHistoryOpen}>
        <DialogContent className="w-[92vw] max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>Files history</DialogTitle></DialogHeader>
          {(() => {
            const target = members.find((member) => member.id === detailDriverId);
            const targetInvoices = target ? invoices.filter((invoice) => invoice.driverUserId === target.driverUserId) : [];
            const files = target?.profile.sharedFiles || [];
            return (
              <div className="space-y-3 pt-2">
                {files.map((file) => <a key={file.id} href={file.dataUrl} download={file.name} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl bg-muted p-3 text-sm font-bold text-primary"><span className="truncate">{file.name}</span><span className="ml-2 shrink-0 text-xs text-muted-foreground">{file.uploadedAt}</span></a>)}
                {targetInvoices.map((invoice) => <div key={invoice.id} className="flex items-center justify-between rounded-xl bg-muted p-3 text-sm"><span className="truncate">{invoice.title}</span><span className={`ml-2 shrink-0 text-xs font-bold ${invoice.revokedAt ? "text-rose-300" : "text-emerald-300"}`}>{invoice.revokedAt ? "Revoked" : "Sent"}</span></div>)}
                {!files.length && !targetInvoices.length && <p className="py-6 text-center text-sm text-muted-foreground">No files or invoices sent yet.</p>}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(historyDriverId)} onOpenChange={(open) => !open && setHistoryDriverId(null)}>
        <DialogContent className="w-[90vw] max-w-md rounded-2xl">
          {historyDriverId && (() => {
            const driver = state.drivers.find((item) => item.id === historyDriverId);
            if (!driver) return null;
            const pays = state.driverPays.filter((pay) => pay.driverId === driver.id).slice().reverse();
            return <><DialogHeader><DialogTitle className="text-xl font-bold">{driver.name} payment history</DialogTitle></DialogHeader><div className="space-y-2 mt-3">{pays.length === 0 ? <p className="text-sm text-muted-foreground">No payments recorded.</p> : pays.map((pay) => <div key={pay.id} className="flex items-center justify-between rounded-xl bg-green-50 p-3"><div><div className="font-bold text-sm">{pay.description}</div><div className="text-xs text-green-700">{pay.date} • Paid</div></div><div className="font-black text-green-700">₹{pay.amount.toLocaleString()}</div></div>)}</div></>;
          })()}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
