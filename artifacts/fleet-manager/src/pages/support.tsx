import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { createSupportTicket, getSupportTickets, type SupportTicket } from "@/lib/workspace";
import { ArrowLeft, CheckCircle2, LifeBuoy, Paperclip, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";

const categories = [
  "Report a Problem",
  "Payment/Subscription Issue",
  "Login/Account Issue",
  "Vehicle/Driver Issue",
  "Attendance Issue",
  "Work Log Issue",
  "Receipt/Report Issue",
  "Other",
];

export default function Support() {
  const { session } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [category, setCategory] = useState(categories[0]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<SupportTicket["priority"]>("Medium");
  const [attachment, setAttachment] = useState<{ dataUrl: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const attachmentInput = useRef<HTMLInputElement>(null);

  const loadTickets = async () => {
    if (!session) return;
    try {
      setTickets((await getSupportTickets(session.access_token)).tickets);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your support tickets");
    }
  };
  useEffect(() => { void loadTickets(); }, [session]);

  const handleAttachment = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);
    if (!allowedTypes.has(file.type)) {
      setError("Choose a PNG, JPG, WebP, GIF or PDF file.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Attachments must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAttachment({ dataUrl: reader.result, name: file.name });
      } else {
        setError("Could not read that attachment. Please choose it again.");
      }
    };
    reader.onerror = () => setError("Could not read that attachment. Please choose it again.");
    reader.readAsDataURL(file);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await createSupportTicket(session.access_token, {
        category,
        subject,
        description,
        priority,
        ...(attachment ? { attachmentDataUrl: attachment.dataUrl, attachmentName: attachment.name } : {}),
      });
      setSubject("");
      setDescription("");
      setAttachment(null);
      if (attachmentInput.current) attachmentInput.current.value = "";
      setMessage("Your support request has been submitted successfully.");
      await loadTickets();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit support request");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <div className="fm-page-header sticky top-0 z-10">
        <div className="flex items-center gap-3"><Link href="/settings" className="text-muted-foreground"><ArrowLeft size={21} /></Link><div><h1>Help & Support</h1><p>We keep your fleet moving.</p></div></div>
        <LifeBuoy className="text-primary" size={25} />
      </div>
      <main className="fm-page-content space-y-4">
        <section className="fm-settings-card space-y-3">
          <div className="fm-settings-section-title">Contact Support</div>
          <p className="text-sm text-muted-foreground">Tell us what went wrong. Your account, role, and ticket time are attached automatically.</p>
          <form onSubmit={(event) => void submit(event)} className="fm-form">
            <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as SupportTicket["priority"])}><option>Low</option><option>Medium</option><option>High</option></select></label>
            <label>Subject<input required maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Short summary" /></label>
            <label>Detailed description<textarea required maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain what happened and what you expected." /></label>
            <label className="flex min-w-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm font-bold text-primary"><Paperclip size={17} /><span className="truncate">{attachment ? attachment.name : "Add screenshot or PDF (up to 5 MB)"}</span><input ref={attachmentInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" onChange={handleAttachment} className="sr-only" /></label>
            <button type="submit" disabled={busy} className="fm-primary-button fm-submit-button"><Send size={17} />{busy ? "Submitting..." : "Submit request"}</button>
          </form>
          {message && <p className="rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-300"><CheckCircle2 className="mr-2 inline" size={16} />{message}</p>}
          {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}
        </section>
        <section className="fm-settings-card space-y-3">
          <div className="fm-settings-section-title">My Tickets</div>
          {tickets.map((ticket) => <article key={ticket.id} className="rounded-xl border border-border bg-background p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate">{ticket.subject}</strong><span className="mt-1 block text-xs text-muted-foreground">{ticket.category} · {new Date(ticket.createdAt).toLocaleString("en-IN")}</span></div><span className={`fm-status ${ticket.status === "Resolved" || ticket.status === "Closed" ? "fm-status-active" : "fm-status-idle"}`}>{ticket.status}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{ticket.description}</p>{ticket.adminReply && <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm"><strong className="text-primary">Admin reply</strong><p className="mt-1 whitespace-pre-wrap">{ticket.adminReply}</p></div>}{ticket.attachmentUrl && <a href={ticket.attachmentUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-bold text-primary">View attachment</a>}</article>)}
          {!tickets.length && <p className="text-sm text-muted-foreground">No support tickets yet.</p>}
        </section>
      </main>
    </Layout>
  );
}