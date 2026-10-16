import { Layout } from "@/components/layout";
import { useStore } from "@/lib/store";
import { useState } from "react";
import { useEffect } from "react";
import { LogOut, CheckCircle2, UserCircle, ImagePlus, Download, Trash2, ArrowLeft, Save, LifeBuoy } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { createHtmlPdf } from "@/lib/pdf";
import { resetOwnerWorkspace, uploadBusinessLogo } from "@/lib/workspace";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character] || character));
}

function formatRows<T>(items: T[], render: (item: T) => string, empty = "No records") {
  return items.length ? items.map(render).join("") : `<div class="empty">${empty}</div>`;
}

export default function Settings() {
  const { state, dispatch } = useStore();
  const { toast } = useToast();
  const { user, session, signingIn: authBusy, signOut } = useAuth();
  
  const [businessName, setBusinessName] = useState(state.settings.businessName);
  const [companyName, setCompanyName] = useState(state.settings.companyName || "");
  const [ownerName, setOwnerName] = useState(state.settings.ownerName || "");
  const [phone, setPhone] = useState(state.settings.phone || "");
  const [address, setAddress] = useState(state.settings.address || "");
  const [email, setEmail] = useState(state.settings.email || "");
  const [upiId, setUpiId] = useState(state.settings.upiId || "");
  const [bankName, setBankName] = useState(state.settings.bankName || "");
  const [gstNumber, setGstNumber] = useState(state.settings.gstNumber || "");
  const [gstPercentage, setGstPercentage] = useState(state.settings.gstPercentage || 0);
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    setBusinessName(state.settings.businessName);
    setCompanyName(state.settings.companyName || "");
    setOwnerName(state.settings.ownerName || "");
    setPhone(state.settings.phone || "");
    setAddress(state.settings.address || "");
    setEmail(state.settings.email || "");
    setUpiId(state.settings.upiId || "");
    setBankName(state.settings.bankName || "");
    setGstNumber(state.settings.gstNumber || "");
    setGstPercentage(state.settings.gstPercentage || 0);
  }, [state.settings]);
  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast({ title: "Could not sign out", description: error.message });
    } else {
      toast({ title: "Signed out", description: "Your Google account data remains safely linked to your account." });
      window.location.replace(new URL(import.meta.env.BASE_URL || "/", window.location.origin).toString());
    }
  };

  const handleSave = () => {
    dispatch({ 
      type: 'UPDATE_SETTINGS', 
      payload: { businessName, companyName, ownerName, phone, address, email, upiId, bankName, gstNumber, gstPercentage: Math.max(0, Number(gstPercentage) || 0) }
    });
    navigator.vibrate?.(45);
    toast({
      title: "Settings Saved",
      description: "Business details have been updated."
    });
  };

  const handleLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!session) {
      toast({ title: "Sign in required", description: "Please sign in again before uploading a logo." });
      return;
    }
    setLogoBusy(true);
    try {
      const { logoUrl } = await uploadBusinessLogo(session.access_token, file);
      dispatch({ type: "UPDATE_SETTINGS", payload: { logoUrl } });
      toast({ title: "Logo saved", description: "Your business logo is now stored in Supabase." });
    } catch (error) {
      toast({
        title: "Could not save logo",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setLogoBusy(false);
      event.target.value = "";
    }
  };

  const exportData = async () => {
    const reportHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}body{margin:0;background:#eef1f4;color:#151515;font:12px Arial,sans-serif}.sheet{width:794px;min-height:1123px;background:#fff;margin:0 auto;padding:30px}.header{border-bottom:3px solid #171717;padding-bottom:16px}.title{font-size:26px;font-weight:800}.subtitle{margin-top:5px;color:#555}.section{margin-top:18px}.section h2{font-size:15px;margin:0 0 7px;text-transform:uppercase}.grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #c6cbd0;border-radius:4px}.cell{padding:8px;border-bottom:1px solid #e1e4e7;overflow-wrap:anywhere}.cell:nth-child(odd){font-weight:700;background:#f7f8f9}.row{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;border:1px solid #c6cbd0;border-bottom:0}.row:last-child{border-bottom:1px solid #c6cbd0}.row div{padding:7px;border-right:1px solid #e1e4e7;overflow-wrap:anywhere}.row div:last-child{border-right:0}.head{background:#252525;color:#fff;font-weight:700}.empty{border:1px dashed #b9bec4;padding:14px;color:#666}.footer{margin-top:22px;border-top:1px solid #aaa;padding-top:9px;text-align:center;color:#777;font-size:10px}
    </style></head><body><main class="sheet">
      <header class="header"><div class="title">${escapeHtml(companyName || businessName || "Fleetvix")} — Workspace Report</div><div class="subtitle">Exported ${escapeHtml(new Date().toLocaleString("en-IN"))}</div></header>
      <section class="section"><h2>Business Information</h2><div class="grid"><div class="cell">Owner / Company</div><div class="cell">${escapeHtml(ownerName || companyName || businessName)}</div><div class="cell">Phone</div><div class="cell">${escapeHtml(phone || "—")}</div><div class="cell">Email</div><div class="cell">${escapeHtml(email || "—")}</div><div class="cell">Address</div><div class="cell">${escapeHtml(address || "—")}</div><div class="cell">GST</div><div class="cell">${escapeHtml(gstNumber || "—")} (${gstPercentage || 0}%)</div></div></section>
      <section class="section"><h2>Vehicles</h2><div class="row head"><div>Name</div><div>Type</div><div>Registration</div><div>Status</div></div>${formatRows(state.vehicles, (vehicle) => `<div class="row"><div>${escapeHtml(vehicle.name)}</div><div>${escapeHtml(vehicle.type)}</div><div>${escapeHtml(vehicle.regNumber)}</div><div>${escapeHtml(vehicle.status)}</div></div>`)}</section>
      <section class="section"><h2>Customers &amp; Khata</h2><div class="row head"><div>Customer</div><div>Phone</div><div>Work Logs</div><div>Status</div></div>${formatRows(state.customers, (customer) => `<div class="row"><div>${escapeHtml(customer.name)}</div><div>${escapeHtml(customer.phone)}</div><div>${state.ledgers.filter((entry) => entry.customerId === customer.id && entry.type === "Charge").length}</div><div>${customer.completed ? "Work Complete" : "Active"}</div></div>`)}</section>
      <section class="section"><h2>Work Logs</h2><div class="row head"><div>Date</div><div>Vehicle</div><div>Description</div><div>Amount</div></div>${formatRows(state.logs, (log) => `<div class="row"><div>${escapeHtml(log.date)}</div><div>${escapeHtml(state.vehicles.find((vehicle) => vehicle.id === log.vehicleId)?.name || "Vehicle")}</div><div>${escapeHtml(log.description || "Work entry")}</div><div>₹${log.amount.toLocaleString("en-IN")}</div></div>`)}</section>
      <section class="section"><h2>Drivers</h2><div class="row head"><div>Name</div><div>Type</div><div>Phone</div><div>Rate</div></div>${formatRows(state.drivers, (driver) => `<div class="row"><div>${escapeHtml(driver.name)}</div><div>${escapeHtml(driver.type)}</div><div>${escapeHtml(driver.phone)}</div><div>₹${driver.dailyRate.toLocaleString("en-IN")}</div></div>`)}</section>
      <section class="section"><h2>Fuel Records</h2><div class="row head"><div>Date</div><div>Vehicle</div><div>Quantity</div><div>Cost</div></div>${formatRows(state.fuelRecords, (fuel) => `<div class="row"><div>${escapeHtml(fuel.date)}</div><div>${escapeHtml(state.vehicles.find((vehicle) => vehicle.id === fuel.vehicleId)?.name || "Vehicle")}</div><div>${fuel.quantity} L</div><div>₹${fuel.cost.toLocaleString("en-IN")}</div></div>`)}</section>
      <footer class="footer">Fleetvix workspace export • ${escapeHtml(companyName || businessName || "Fleetvix")}</footer>
    </main></body></html>`;
    const blob = await createHtmlPdf(reportHtml);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(businessName || "fleet-manager").replace(/\s+/g, "-").toLowerCase()}-workspace-report.pdf`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const resetData = () => {
    if (!window.confirm("Reset all customers and fleet records? Driver accounts and their access will remain. This cannot be undone.")) return;
    if (!session) return;
    void resetOwnerWorkspace(session.access_token)
      .then(() => {
        dispatch({ type: "RESET_OWNER_DATA" });
        toast({ title: "Fleet records reset", description: "Customers, vehicles and fleet records were removed. Driver accounts remain." });
      })
      .catch((error) => toast({ title: "Could not reset data", description: error instanceof Error ? error.message : "Please try again." }));
  };

  return (
    <Layout>
      <div className="flex items-center justify-between bg-[#1b2d3c] px-5 py-4 sticky top-0 z-10 border-b border-border">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-muted-foreground"><ArrowLeft size={22} /></Link>
          <h1 className="text-2xl font-black tracking-tight">Settings</h1>
        </div>
        <button type="button" onClick={handleSave} className="rounded-full bg-primary px-5 py-2 text-sm font-black text-primary-foreground">Save</button>
      </div>

      <div className="px-3 py-5 space-y-3 pb-8">
        
        <section className="fm-settings-card">
          <div className="fm-settings-section-title">Business Logo</div>
          <p className="fm-settings-help">Used on receipts, invoices and app header</p>
          <div className="flex justify-center py-2">
             {state.settings.logoUrl ? <img src={state.settings.logoUrl} alt="Business logo" className="h-20 w-20 rounded-full border-2 border-primary object-cover" /> : <div className="fm-settings-logo-placeholder"><UserCircle size={42} /></div>}
          </div>
           <label className={`mx-auto flex w-fit items-center justify-center gap-2 rounded-full border border-dashed border-border px-4 py-2 text-xs font-bold ${logoBusy ? "cursor-wait opacity-60" : "cursor-pointer"}`}>
             <ImagePlus size={15} /> {logoBusy ? "Saving Logo..." : "Change Logo"}
             <input data-testid="input-business-logo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void handleLogo(event)} disabled={logoBusy} className="sr-only" />
          </label>
           <p className="text-center text-[11px] text-muted-foreground">PNG, JPG, WebP or GIF up to 5 MB. Stored securely in Supabase Storage.</p>
        </section>

        <section className="fm-settings-card space-y-3">
          <div className="fm-settings-section-title">App Info</div>
          <label className="fm-settings-label">App Name<input value="Fleetvix" readOnly /></label>
        </section>

        <section className="fm-settings-card space-y-3">
          <div className="fm-settings-section-title">Owner / Business Info</div>
          <label className="fm-settings-label">Company Name<input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Rajmudra Construction" /></label>
          <label className="fm-settings-label">Owner Name<input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Your name" /></label>
          <label className="fm-settings-label">Phone Number<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" /></label>
          <label className="fm-settings-label">Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" /></label>
          <label className="fm-settings-label">Address<textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Address" /></label>
        </section>

        <section className="fm-settings-card space-y-3">
          <div className="fm-settings-section-title">Payment Info</div>
          <label className="fm-settings-label">UPI ID<input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="9876543210@upi" /></label>
          <div className="rounded-lg bg-[#4b2d05] p-2 text-[10px] text-amber-100">ⓘ UPI ID is used for generating payment QR codes. No UPI ID is shown on the QR — just the payment amount.</div>
          <label className="fm-settings-label">Bank Name<input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Bank name" /></label>
          <label className="fm-settings-label">GST Number<input value={gstNumber} onChange={e => setGstNumber(e.target.value)} placeholder="GST number (optional)" /></label>
          <label className="fm-settings-label">GST Percentage<input type="number" min="0" max="100" step="0.01" value={gstPercentage || ""} onChange={e => setGstPercentage(Number(e.target.value))} placeholder="e.g. 18" /></label>
          <p className="text-[11px] text-muted-foreground">GST is added only for customers where you turn on Add GST.</p>
        </section>

        <button type="button" onClick={handleSave} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary p-4 font-black text-primary-foreground"><Save size={17} /> Save All Settings</button>

        <section className="fm-settings-card space-y-3">
          <div className="fm-settings-section-title">Help & Support</div>
          <p className="fm-settings-help">Report a problem, ask about payments, or contact the Fleetvix team.</p>
          <Link href="/support" className="flex items-center justify-center gap-2 rounded-xl border border-primary/40 p-3 font-bold text-primary"><LifeBuoy size={17} /> Contact Support</Link>
        </section>

        <section className="fm-settings-card space-y-4">
          <div className="flex items-center gap-3">
            <UserCircle size={40} className="text-muted-foreground" />
            <div>
              <h3 className="font-bold text-lg">Signed-in Account</h3>
              <p className="text-sm text-muted-foreground">{user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email}</p>
              <p className="text-xs text-green-400 font-semibold mt-1">Google account workspace synced</p>
            </div>
          </div>
          <button
            data-testid="button-logout"
            type="button"
            disabled={authBusy}
            onClick={handleLogout}
            className="w-full border border-rose-400/40 text-rose-300 font-bold p-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogOut size={18} />
            {authBusy ? "Signing out..." : "Logout"}
          </button>
        </section>

        <section className="fm-settings-card">
          <div className="fm-settings-section-title">Workspace Data</div>
           <p className="fm-settings-help mt-1">Export a backup or permanently remove customers and fleet records. Joined driver accounts, profiles and access remain available.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void exportData()} className="flex items-center justify-center gap-2 rounded-xl border border-border p-3 text-sm font-bold text-primary">
              <Download size={16} /> Export
            </button>
            <button type="button" onClick={resetData} className="flex items-center justify-center gap-2 rounded-xl border border-rose-400/40 p-3 text-sm font-bold text-rose-300">
              <Trash2 size={16} /> Reset All Data
            </button>
          </div>
        </section>
      </div>
    </Layout>
  );
}
