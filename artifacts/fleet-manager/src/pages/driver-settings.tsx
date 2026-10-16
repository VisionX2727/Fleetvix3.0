import { Layout } from "@/components/layout";
import { useRole } from "@/lib/role";
import { useStore } from "@/lib/store";
import { DriverDocument } from "@/lib/workspace";
import { resetDriverWorkspace } from "@/lib/workspace";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Download, FileUp, LifeBuoy, LogOut, Save, Trash2 } from "lucide-react";
import { createHtmlPdf } from "@/lib/pdf";
import { useState } from "react";
import { Link } from "wouter";

export default function DriverSettings() {
  const { state, dispatch } = useStore();
  const { member, ownerSettings, availableVehicles = [], updateDriverProfile } = useRole();
  const { session, signOut } = useAuth();
  const profile = member?.profile;
  const [name, setName] = useState(profile?.name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [address, setAddress] = useState(profile?.address || "");
  const [vehicleIds, setVehicleIds] = useState(profile?.vehicleIds || []);
  const [documents, setDocuments] = useState<DriverDocument[]>(profile?.documents || []);
  const [message, setMessage] = useState("");

  if (!profile) return null;
  const save = async () => {
    await updateDriverProfile({ ...profile, name, phone, address, vehicleIds, documents });
    setMessage("Driver profile saved.");
    window.setTimeout(() => window.location.reload(), 400);
  };
  const uploadDocument = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDocuments((current) => [...current, { id: `${Date.now()}`, name: file.name, type: file.type, dataUrl: String(reader.result), uploadedAt: new Date().toISOString().slice(0, 10) }]);
    reader.readAsDataURL(file);
  };
  const resetMyData = () => {
    if (!window.confirm("Factory reset your driver records? Your driver account and vehicle access will remain, but your synced logs, fuel, payments, notes and maintenance records will be deleted.")) return;
    if (!session) return;
    void resetDriverWorkspace(session.access_token)
      .then(() => {
        dispatch({ type: "RESET_DRIVER_DATA" });
        setMessage("Your driver records were reset.");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not reset driver records."));
  };
  const downloadDriverReport = async () => {
    const driver = state.drivers[0];
    const logs = state.logs.slice().sort((a, b) => a.date.localeCompare(b.date));
    const paid = state.driverPays.reduce((sum, payment) => sum + payment.amount, 0);
    const absent = state.driverAbsentDates || [];
    const rows = logs.map((log) => `<tr><td>${log.date}</td><td>${state.vehicles.find((vehicle) => vehicle.id === log.vehicleId)?.name || "Vehicle"}</td><td>${log.description || "Work entry"}</td><td>₹${(log.driverDailyRate ?? driver?.dailyRate ?? 0).toLocaleString("en-IN")}</td></tr>`).join("");
    const absentRows = absent.map((date) => `<li>${date} — Absent — ₹0</li>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#eef1f4;font:13px Arial;color:#18202b}.sheet{width:794px;min-height:1123px;background:#fff;padding:36px}.brand{border-bottom:4px solid #f5b91d;padding-bottom:18px}.brand h1{margin:0;font-size:28px}h2{font-size:17px;border-bottom:1px solid #d7dde5;padding-bottom:7px;margin-top:24px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.card{border:1px solid #d7dde5;border-radius:10px;padding:12px}.card b{display:block;font-size:19px;margin-top:5px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d7dde5;padding:8px;text-align:left}th{background:#f4f6f8}td:last-child,th:last-child{text-align:right}</style></head><body><main class="sheet"><header class="brand"><h1>${ownerSettings?.companyName || ownerSettings?.businessName || "Fleetvix"} — Driver Report</h1><p>${profile.name || "Driver"} • ${profile.phone}</p></header><section class="grid"><div class="card">Working days<b>${new Set(logs.map((log) => log.date)).size}</b></div><div class="card">Paid<b>₹${paid.toLocaleString("en-IN")}</b></div><div class="card">Vehicles<b>${vehicleIds.length}</b></div></section><h2>Profile &amp; Vehicles</h2><p>Name: ${profile.name || "—"}<br>Phone: ${profile.phone || "—"}<br>Address: ${address || "—"}<br>Vehicles: ${vehicleIds.map((id) => state.vehicles.find((vehicle) => vehicle.id === id)?.name || id).join(", ") || "None"}</p><h2>Work Logs</h2><table><thead><tr><th>Date</th><th>Vehicle</th><th>Description</th><th>Amount</th></tr></thead><tbody>${rows || "<tr><td colspan='4'>No work logs</td></tr>"}</tbody></table><h2>Paid History</h2><p>${state.driverPays.map((payment) => `${payment.date} — ₹${payment.amount.toLocaleString("en-IN")} — ${payment.description || "Driver payment"}`).join("<br>") || "No paid history"}</p><h2>Absent Days</h2><ul>${absentRows || "<li>No absent days</li>"}</ul><h2>Documents</h2><p>${documents.map((document) => document.name).join(", ") || "No documents"}</p></main></body></html>`;
    const blob = await createHtmlPdf(html);
    const file = new File([blob], `${(profile.name || "driver").replace(/\W+/g, "-").toLowerCase()}-report.pdf`, { type: "application/pdf" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="flex items-center justify-between bg-[#1b2d3c] px-5 py-4 sticky top-0 z-10 border-b border-border"><div className="flex items-center gap-2"><Link href="/" className="text-muted-foreground"><ArrowLeft size={22} /></Link><h1 className="text-2xl font-black">Settings</h1></div><button type="button" onClick={() => void save()} className="rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground"><Save size={16} className="mr-1 inline" />Save</button></div>
      <main className="space-y-3 px-3 py-5 pb-8">
        <section className="fm-settings-card"><div className="fm-settings-section-title">Owner Branding</div><div className="mt-3 flex items-center gap-3">{ownerSettings?.logoUrl ? <img src={ownerSettings.logoUrl} alt="Owner logo" className="h-16 w-16 rounded-full object-cover" /> : <div className="fm-settings-logo-placeholder text-sm">OF</div>}<div><strong>{ownerSettings?.companyName || ownerSettings?.businessName || "Owner Fleet"}</strong><p className="text-xs text-muted-foreground">{ownerSettings?.ownerName || "Owner"}</p></div></div><p className="mt-3 text-xs text-muted-foreground">Owner logo and company name are managed by the owner and cannot be changed here.</p></section>
        <section className="fm-settings-card space-y-3"><div className="fm-settings-section-title">My Details</div><label className="fm-settings-label">Name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label className="fm-settings-label">Mobile Number<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label className="fm-settings-label">Address<textarea value={address} onChange={(event) => setAddress(event.target.value)} /></label></section>
        <section className="fm-settings-card space-y-3"><div className="fm-settings-section-title">Owner-set Daily Rate</div><p className="text-xs text-muted-foreground">Only the owner can change your rate. Each new work log stores the rate that was active on that day.</p><div className="rounded-xl bg-muted p-4 text-xl font-black text-primary">₹{(state.drivers[0]?.dailyRate || 0).toLocaleString("en-IN")} <span className="text-sm font-bold text-muted-foreground">per working day</span></div></section>
        <section className="fm-settings-card space-y-3"><div className="fm-settings-section-title">My Vehicles</div><p className="text-xs text-muted-foreground">Select only vehicles you work with. You cannot access other vehicles.</p>{availableVehicles.length ? availableVehicles.map((vehicle) => <label key={vehicle.id} className="flex items-center gap-3 rounded-xl bg-muted p-3 text-sm font-bold"><input type="checkbox" checked={vehicleIds.includes(vehicle.id)} onChange={(event) => setVehicleIds((current) => event.target.checked ? [...new Set([...current, vehicle.id])] : current.filter((id) => id !== vehicle.id))} />{vehicle.name} <span className="ml-auto text-xs text-muted-foreground">{vehicle.type}</span></label>) : <p className="text-sm text-muted-foreground">The owner has not added vehicles yet.</p>}</section>
        <section className="fm-settings-card space-y-3"><div className="fm-settings-section-title">Optional Documents</div><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm font-bold text-primary"><FileUp size={17} /> Upload license or document<input type="file" accept="image/*,.pdf" onChange={uploadDocument} className="sr-only" /></label>{documents.map((document) => <div key={document.id} className="flex items-center justify-between rounded-xl bg-muted p-3 text-xs"><a href={document.dataUrl} target="_blank" rel="noreferrer" className="truncate font-bold text-primary">{document.name}</a><span className="text-muted-foreground">{document.uploadedAt}</span></div>)}</section>
        {(profile.sharedFiles || []).length > 0 && <section className="fm-settings-card space-y-3"><div className="fm-settings-section-title">Files from Owner</div>{(profile.sharedFiles || []).map((file) => <a key={file.id} href={file.dataUrl} download={file.name} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl bg-muted p-3 text-sm font-bold text-primary"><Download size={17} /><span className="min-w-0 flex-1 truncate">{file.name}</span><span className="text-xs text-muted-foreground">{file.uploadedAt}</span></a>)}</section>}
        {message && <p className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-300">{message}</p>}
         <section className="fm-settings-card space-y-3"><div className="fm-settings-section-title">Help & Support</div><p className="text-xs text-muted-foreground">Need help with your vehicle, attendance, work logs or account?</p><Link href="/support" className="flex items-center justify-center gap-2 rounded-xl border border-primary/40 p-3 font-bold text-primary"><LifeBuoy size={17} /> Contact Support</Link></section>
        <section className="fm-settings-card space-y-3"><div className="fm-settings-section-title">Driver Data</div><p className="text-xs text-muted-foreground">Reset this device's driver workspace records without removing your owner membership or previously synced owner history.</p><button type="button" onClick={() => void downloadDriverReport()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 p-3 font-bold text-primary"><Download size={17} /> Download Driver Report PDF</button><button type="button" onClick={resetMyData} className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/40 p-3 font-bold text-rose-300"><Trash2 size={17} /> Reset All Driver Data</button></section>
        <button type="button" onClick={() => void signOut()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/40 p-3 font-bold text-rose-300"><LogOut size={17} /> Logout</button>
      </main>
    </Layout>
  );
}