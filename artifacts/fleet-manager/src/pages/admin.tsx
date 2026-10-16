import { useAuth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getAdminStats, getAdminTickets, updateAdminTicket, type AdminStats, type SupportTicket } from "@/lib/workspace";
import { getGetAdminSiteContentQueryKey, useGetAdminSiteContent, useUpdateAdminSiteContent, type SiteContentInput } from "@workspace/api-client-react";
import { AlertTriangle, BarChart3, CheckCircle2, ChevronRight, FileText, Filter, LifeBuoy, LogOut, MessageSquare, RefreshCw, Search, ShieldCheck, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";

const emptyStats: AdminStats = {
  totalUsers: 0, totalOwners: 0, totalDrivers: 0, activeSubscriptions: 0,
  expiredSubscriptions: 0, openSupportTickets: 0, highPriorityTickets: 0, totalTickets: 0,
};
const supportCategories = ["Report a Problem", "Payment/Subscription Issue", "Login/Account Issue", "Vehicle/Driver Issue", "Attendance Issue", "Work Log Issue", "Receipt/Report Issue", "Other"];
const blankSiteContent: SiteContentInput = {
  termsContent: "", privacyContent: "", legalName: "", businessAddress: "",
  supportEmail: "", privacyEmail: "", supportPhone: "",
};

export default function AdminDashboard() {
  const { user, session, signOut } = useAuth();
  const [stats, setStats] = useState(emptyStats);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFocus, setActiveFocus] = useState("All support");
  const [section, setSection] = useState<"support" | "site">("support");
  const [sitePanel, setSitePanel] = useState<"contacts" | "terms" | "privacy">("contacts");
  const [mobileDetail, setMobileDetail] = useState(false);
  const [siteForm, setSiteForm] = useState<SiteContentInput>(blankSiteContent);
  const [siteReady, setSiteReady] = useState(false);
  const [siteNotice, setSiteNotice] = useState("");

  const adminRequest = { headers: { Authorization: `Bearer ${session?.access_token || ""}` } };
  const siteQuery = useGetAdminSiteContent({
    query: { enabled: Boolean(session && user && isAdminEmail(user.email)), queryKey: getGetAdminSiteContentQueryKey() },
    request: adminRequest,
  });
  const updateSite = useUpdateAdminSiteContent({ request: adminRequest });

  useEffect(() => {
    if (!siteQuery.data?.content || siteReady) return;
    const { termsContent, privacyContent, legalName, businessAddress, supportEmail, privacyEmail, supportPhone } = siteQuery.data.content;
    setSiteForm({ termsContent, privacyContent, legalName, businessAddress, supportEmail, privacyEmail, supportPhone });
    setSiteReady(true);
  }, [siteQuery.data, siteReady]);

  const load = async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const [summary, list] = await Promise.all([
        getAdminStats(session.access_token),
        getAdminTickets(session.access_token, { search, status, priority, category }),
      ]);
      setStats(summary.stats);
      setTickets(list.tickets);
      setSelected((current) => current ? list.tickets.find((ticket) => ticket.id === current.id) || current : list.tickets[0] || null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the admin dashboard");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [session, status, priority, category]);

  if (!user || !session || !isAdminEmail(user.email)) {
    return <main className="fm-admin-shell flex items-center justify-center p-6"><div className="max-w-md rounded-3xl border border-border bg-card p-7 text-center"><ShieldCheck className="mx-auto text-primary" size={40} /><h1 className="mt-4 text-2xl font-black">Admin access only</h1><p className="mt-2 text-sm text-muted-foreground">This dashboard is restricted to authorized Fleetvix administrators.</p><button type="button" onClick={() => void signOut()} className="mt-5 rounded-xl bg-primary px-5 py-3 font-black text-primary-foreground">Back to sign in</button></div></main>;
  }

  const saveTicket = async (payload: { status?: SupportTicket["status"]; priority?: SupportTicket["priority"]; adminReply?: string }) => {
    if (!session || !selected) return;
    setBusy(true);
    setError("");
    try {
      const result = await updateAdminTicket(session.access_token, selected.id, payload);
      setSelected(result.ticket);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this ticket");
    } finally {
      setBusy(false);
    }
  };
  const applyFocus = (label: string) => {
    setActiveFocus(label);
    setSearch("");
    setCategory("");
    if (label === "Open support") { setStatus("Open"); setPriority(""); }
    else if (label === "Urgent problems") { setStatus(""); setPriority("High"); }
    else if (label === "Resolved history") { setStatus("Resolved"); setPriority(""); }
    else { setStatus(""); setPriority(""); }
  };
  const applyCategory = (value: string) => {
    setActiveFocus(value || "All support");
    setStatus(""); setPriority(""); setCategory(value);
  };
  const statCards = [
    { label: "Total users", value: stats.totalUsers, Icon: Users },
    { label: "Open tickets", value: stats.openSupportTickets, Icon: MessageSquare, focus: "Open support" },
    { label: "High priority", value: stats.highPriorityTickets, Icon: Filter, focus: "Urgent problems" },
    { label: "Active plans", value: stats.activeSubscriptions, Icon: CheckCircle2 },
    { label: "Owners", value: stats.totalOwners, Icon: ShieldCheck },
    { label: "Drivers", value: stats.totalDrivers, Icon: Users },
    { label: "Expired plans", value: stats.expiredSubscriptions, Icon: X },
    { label: "All tickets", value: stats.totalTickets, Icon: MessageSquare, focus: "All support" },
  ];
  const saveSite = () => {
    setSiteNotice("");
    updateSite.mutate({ data: siteForm }, {
      onSuccess: (result) => {
        setSiteNotice("Site details saved.");
        setSiteReady(false);
        siteQuery.refetch();
        if (result.content) {
          setSiteForm({
            termsContent: result.content.termsContent, privacyContent: result.content.privacyContent,
            legalName: result.content.legalName, businessAddress: result.content.businessAddress,
            supportEmail: result.content.supportEmail, privacyEmail: result.content.privacyEmail,
            supportPhone: result.content.supportPhone,
          });
          setSiteReady(true);
        }
      },
      onError: (cause) => setSiteNotice(cause instanceof Error ? cause.message : "Could not save site details."),
    });
  };
  const updateSiteField = (key: keyof SiteContentInput, value: string) => setSiteForm((current) => ({ ...current, [key]: value }));
  const ticketDetails = (ticket: SupportTicket) => (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-primary">{ticket.id}</p><h2 className="mt-1 break-words text-xl font-black">{ticket.subject}</h2><p className="mt-1 break-all text-xs text-muted-foreground">{ticket.userName || "Fleetvix user"} · {ticket.userEmail}</p></div><span className="fm-status fm-status-idle">{ticket.status}</span></div>
      <div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-background p-3"><span className="text-muted-foreground">Category</span><strong className="mt-1 block break-words">{ticket.category}</strong></div><div className="rounded-xl bg-background p-3"><span className="text-muted-foreground">Created</span><strong className="mt-1 block">{new Date(ticket.createdAt).toLocaleDateString()}</strong></div></div>
      <div className="rounded-xl bg-background p-3"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{ticket.description}</p>{ticket.attachmentUrl && <a href={ticket.attachmentUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-bold text-primary">View attachment</a>}</div>
      <label className="fm-settings-label">Status<select value={ticket.status} onChange={(event) => void saveTicket({ status: event.target.value as SupportTicket["status"] })}><option>Open</option><option>In Progress</option><option>Resolved</option><option>Closed</option></select></label>
      <label className="fm-settings-label">Priority<select value={ticket.priority} onChange={(event) => void saveTicket({ priority: event.target.value as SupportTicket["priority"] })}><option>High</option><option>Medium</option><option>Low</option></select></label>
      <label className="fm-settings-label">Admin reply<textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a reply the user can see..." /></label>
      <button type="button" disabled={busy} onClick={() => void saveTicket({ adminReply: reply })} className="fm-primary-button w-full disabled:opacity-60">{busy ? "Saving..." : "Save reply"}</button>
    </div>
  );

  return (
    <main className="fm-admin-shell">
      <header className="fm-admin-header">
        <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Fleetvix control room</p><h1 className="text-xl font-black sm:text-2xl">Admin</h1><p className="truncate text-xs text-muted-foreground">{user.email}</p></div>
        <div className="flex shrink-0 items-center gap-2"><Link href="/" className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground">Exit</Link><button type="button" onClick={() => void signOut()} className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-400/30 text-rose-300" aria-label="Log out"><LogOut size={17} /></button></div>
      </header>
      <div className="fm-admin-content">
        <div className="fm-admin-tabs" role="tablist" aria-label="Admin sections">
          <button type="button" role="tab" aria-selected={section === "support"} onClick={() => setSection("support")}><LifeBuoy size={16} /> Support & overview</button>
          <button type="button" role="tab" aria-selected={section === "site"} onClick={() => setSection("site")}><FileText size={16} /> Site & legal</button>
        </div>
        {error && <div className="fm-admin-alert" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Retry</button></div>}
        {section === "support" ? (
          <div className="fm-admin-support">
            <div className="grid shrink-0 grid-cols-4 gap-1.5">
              {statCards.map(({ label, value, Icon, focus }) => {
                const content = <><div className="flex min-w-0 items-center justify-between gap-1"><Icon size={14} className="shrink-0 text-primary" /><span className="truncate text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span></div><strong className="mt-1 block text-lg font-black leading-none">{value}</strong></>;
                return focus ? <button key={label} type="button" onClick={() => applyFocus(focus)} className="fm-admin-stat text-left">{content}</button> : <div key={label} className="fm-admin-stat">{content}</div>;
              })}
            </div>
            <section className="shrink-0 rounded-2xl border border-border bg-card p-2">
              <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">Support desk</p><h2 className="mt-0.5 text-xs font-black">Find and resolve field issues</h2></div><button type="button" onClick={() => void load()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground" aria-label="Refresh support data"><RefreshCw size={14} /></button></div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <button type="button" onClick={() => applyFocus("All support")} className={`fm-admin-tool ${activeFocus === "All support" ? "is-active" : ""}`}><LifeBuoy size={14} />All support</button>
                <button type="button" onClick={() => applyFocus("Open support")} className={`fm-admin-tool ${activeFocus === "Open support" ? "is-active" : ""}`}><MessageSquare size={14} />Open problems</button>
                <button type="button" onClick={() => applyFocus("Urgent problems")} className={`fm-admin-tool ${activeFocus === "Urgent problems" ? "is-active" : ""}`}><AlertTriangle size={14} />Urgent</button>
                <button type="button" onClick={() => applyCategory("Vehicle/Driver Issue")} className={`fm-admin-tool ${activeFocus === "Vehicle/Driver Issue" ? "is-active" : ""}`}><Users size={14} />Fleet issues</button>
                <button type="button" onClick={() => applyCategory("Login/Account Issue")} className={`fm-admin-tool ${activeFocus === "Login/Account Issue" ? "is-active" : ""}`}><ShieldCheck size={14} />Access</button>
                <button type="button" onClick={() => applyFocus("Resolved history")} className={`fm-admin-tool ${activeFocus === "Resolved history" ? "is-active" : ""}`}><CheckCircle2 size={14} />Resolved</button>
              </div>
            </section>
            <section className="fm-admin-workspace fm-admin-ticket-workspace">
              <div className={`fm-admin-list ${mobileDetail ? "fm-mobile-detail-open" : ""}`}>
                <div className="fm-admin-filters">
                  <div className="relative col-span-2 min-w-0 sm:col-span-1"><Search size={15} className="absolute left-3 top-3 text-muted-foreground" /><input aria-label="Search support tickets" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void load()} placeholder="Search tickets or email" /></div>
                  <select aria-label="Filter ticket status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option>Open</option><option>In Progress</option><option>Resolved</option><option>Closed</option></select>
                  <select aria-label="Filter ticket priority" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">All priorities</option><option>High</option><option>Medium</option><option>Low</option></select>
                  <select aria-label="Filter ticket type" value={category} onChange={(event) => applyCategory(event.target.value)} className="col-span-2 sm:col-span-1"><option value="">All problem types</option>{supportCategories.map((item) => <option key={item}>{item}</option>)}</select>
                </div>
                <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><BarChart3 size={13} className="text-primary" />{activeFocus} · {tickets.length} result{tickets.length === 1 ? "" : "s"}</div>
                <div className="fm-admin-ticket-list">
                  {loading && !tickets.length ? <div className="space-y-2" aria-label="Loading tickets">{[0, 1, 2].map((item) => <div key={item} className="fm-admin-skeleton" />)}</div> : tickets.map((ticket) => (
                    <button type="button" key={ticket.id} onClick={() => { setSelected(ticket); setReply(ticket.adminReply || ""); setMobileDetail(true); }} className={`flex w-full min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition ${selected?.id === ticket.id ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/50"}`}>
                      <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><strong className="truncate text-sm">{ticket.subject}</strong><span className={`fm-status ${ticket.priority === "High" ? "fm-status-maintenance" : "fm-status-idle"}`}>{ticket.priority}</span></div><p className="mt-1 truncate text-xs text-muted-foreground">{ticket.userName || ticket.userEmail} · {ticket.category}</p></div>
                      <span className="shrink-0 text-right text-[10px] font-bold text-muted-foreground">{ticket.status}<ChevronRight size={15} className="ml-auto" /></span>
                    </button>
                  ))}
                  {!loading && !tickets.length && <div className="py-8 text-center"><LifeBuoy size={25} className="mx-auto text-primary/70" /><p className="mt-2 text-sm font-bold">No tickets in this view</p><p className="mt-1 text-xs text-muted-foreground">Adjust filters or check back later.</p></div>}
                </div>
              </div>
              <div className={`fm-admin-detail ${mobileDetail ? "" : "hidden sm:block"}`}>
                {selected ? <><button type="button" onClick={() => setMobileDetail(false)} className="mb-4 text-xs font-bold text-primary sm:hidden">Back to tickets</button>{ticketDetails(selected)}</> : <div className="flex min-h-48 items-center justify-center text-center text-sm text-muted-foreground">Select a support ticket to view details.</div>}
              </div>
            </section>
          </div>
        ) : (
          <section className="fm-site-settings">
            <div className="fm-site-intro"><div className="fm-site-icon"><FileText size={18} /></div><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-widest text-primary">Public site settings</p><h2 className="mt-0.5 text-base font-black">Legal documents & contact details</h2><p className="mt-0.5 text-xs text-muted-foreground">Edit the published policies and contact information.</p></div></div>
            <nav className="fm-site-links" aria-label="Direct public policy links">
              <Link href="/privacy-policy"><ShieldCheck size={15} />Open Privacy Policy</Link>
              <Link href="/terms-and-conditions"><FileText size={15} />Open Terms & Conditions</Link>
            </nav>
            <div className="fm-site-tabs" role="tablist" aria-label="Site settings">
              <button type="button" role="tab" aria-selected={sitePanel === "contacts"} onClick={() => { setSitePanel("contacts"); setSiteNotice(""); }}>Contact details</button>
              <button type="button" role="tab" aria-selected={sitePanel === "terms"} onClick={() => { setSitePanel("terms"); setSiteNotice(""); }}>Terms</button>
              <button type="button" role="tab" aria-selected={sitePanel === "privacy"} onClick={() => { setSitePanel("privacy"); setSiteNotice(""); }}>Privacy</button>
            </div>
            {siteQuery.isLoading ? <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-label="Loading site settings">{[0, 1, 2, 3].map((item) => <div key={item} className="fm-admin-skeleton h-12" />)}</div> : siteQuery.isError ? <div className="min-h-0 flex-1 overflow-y-auto p-4"><p className="text-sm text-destructive">Site settings could not be loaded.</p><button type="button" onClick={() => void siteQuery.refetch()} className="mt-3 rounded-xl border border-border px-4 py-2 text-sm font-bold">Retry</button></div> : (
              <>
                <div className="fm-site-form">
                  {sitePanel === "contacts" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="fm-settings-label">Legal business name<input value={siteForm.legalName} onChange={(event) => updateSiteField("legalName", event.target.value)} /></label>
                      <label className="fm-settings-label">Support phone<input type="tel" value={siteForm.supportPhone} onChange={(event) => updateSiteField("supportPhone", event.target.value)} placeholder="+91 ..." /></label>
                      <label className="fm-settings-label">Support email<input type="email" value={siteForm.supportEmail} onChange={(event) => updateSiteField("supportEmail", event.target.value)} placeholder="support@example.com" /></label>
                      <label className="fm-settings-label">Privacy email<input type="email" value={siteForm.privacyEmail} onChange={(event) => updateSiteField("privacyEmail", event.target.value)} placeholder="privacy@example.com" /></label>
                      <label className="fm-settings-label sm:col-span-2">Business address<textarea value={siteForm.businessAddress} onChange={(event) => updateSiteField("businessAddress", event.target.value)} placeholder="Business address shown in the public documents" /></label>
                    </div>
                  ) : sitePanel === "terms" ? (
                    <label className="fm-settings-label fm-policy-editor-label">Terms & Conditions<textarea aria-label="Terms and Conditions policy editor" className="fm-legal-editor" value={siteForm.termsContent} onChange={(event) => updateSiteField("termsContent", event.target.value)} /></label>
                  ) : (
                    <label className="fm-settings-label fm-policy-editor-label">Privacy Policy<textarea aria-label="Privacy Policy editor" className="fm-legal-editor" value={siteForm.privacyContent} onChange={(event) => updateSiteField("privacyContent", event.target.value)} /></label>
                  )}
                </div>
                <div className="fm-site-savebar">
                  <div className="min-w-0 flex-1">
                    {siteNotice && <p role="status" className={`text-xs font-semibold ${siteNotice.includes("saved") ? "text-emerald-300" : "text-destructive"}`}>{siteNotice}</p>}
                    {(sitePanel === "terms" || sitePanel === "privacy") && <p className="text-[10px] leading-snug text-muted-foreground">Supports Markdown. Contact placeholders: {"{{legalName}}"}, {"{{businessAddress}}"}, {"{{supportEmail}}"}, {"{{privacyEmail}}"} and {"{{supportPhone}}"}.</p>}
                  </div>
                  <button type="button" disabled={updateSite.isPending || !siteForm.termsContent.trim() || !siteForm.privacyContent.trim()} onClick={saveSite} className="fm-primary-button w-full shrink-0 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{updateSite.isPending ? "Saving…" : "Save changes"}</button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}