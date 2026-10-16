import { Layout } from "@/components/layout";
import { useRole } from "@/lib/role";
import { FileText, Download, Share2, ExternalLink } from "lucide-react";
import { createHtmlPdf } from "@/lib/pdf";
import type { DriverDocument } from "@/lib/workspace";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

export default function DriverInvoices() {
  const { invoices = [], member } = useRole();
  const [viewing, setViewing] = useState<NonNullable<typeof invoices>[number] | null>(null);
  const activeInvoices = invoices.filter((invoice) => !invoice.revokedAt);
  const download = async (html: string, title: string) => {
    const blob = await createHtmlPdf(html);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.replace(/\W+/g, "-").toLowerCase()}.pdf`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const shareFile = async (file: DriverDocument) => {
    const response = await fetch(file.dataUrl);
    const blob = await response.blob();
    const shareable = new File([blob], file.name, { type: file.type || blob.type || "application/octet-stream" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [shareable] }))) {
      try {
        await navigator.share({ title: file.name, files: [shareable] });
        return;
      } catch (error) {
        if ((error as DOMException)?.name === "AbortError") return;
      }
    }
    const anchor = document.createElement("a");
    anchor.href = file.dataUrl;
    anchor.download = file.name;
    anchor.click();
  };
  const sharedFiles = member?.profile.sharedFiles || [];
  return <Layout><header className="fm-page-header"><div><h1>Invoices &amp; Files</h1><p>Invoices and files sent by your owner</p></div></header><main className="fm-page-content space-y-5 pb-24"><section><h2 className="mb-3 text-sm font-black uppercase tracking-wider text-muted-foreground">Invoices</h2>{activeInvoices.length ? <div className="space-y-3">{activeInvoices.map((invoice) => <article key={invoice.id} className="fm-card p-4"><div className="flex items-center gap-3"><FileText className="text-primary" /><div className="min-w-0 flex-1"><strong className="block truncate">{invoice.title}</strong><small>{new Date(invoice.createdAt).toLocaleDateString("en-IN")}</small></div></div><div className="mt-3 grid grid-cols-3 gap-2"><button type="button" onClick={() => setViewing(invoice)} className="rounded-xl border border-border p-3 text-sm font-bold">View</button><button type="button" onClick={() => void download(invoice.html, invoice.title)} className="rounded-xl border border-border p-3 text-sm font-bold"><Download className="mr-1 inline" size={15} />PDF</button><button type="button" onClick={async () => { if (!navigator.share) return; const file = new File([await createHtmlPdf(invoice.html)], `${invoice.title}.pdf`, { type: "application/pdf" }); await navigator.share({ title: invoice.title, files: [file] }); }} className="rounded-xl border border-border p-3 text-sm font-bold"><Share2 className="mr-1 inline" size={15} />Share</button></div></article>)}</div> : <div className="fm-card p-4 text-sm text-muted-foreground">No invoices received yet.</div>}</section><section><h2 className="mb-3 text-sm font-black uppercase tracking-wider text-muted-foreground">Files</h2>{sharedFiles.length ? <div className="space-y-2">{sharedFiles.map((file) => <div key={file.id} className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm font-bold text-primary"><a href={file.dataUrl} download={file.name} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-3"><ExternalLink size={17} /><span className="min-w-0 flex-1 truncate">{file.name}</span><span className="text-xs text-muted-foreground">{file.uploadedAt}</span></a><button type="button" onClick={() => void shareFile(file)} className="rounded-lg border border-primary/30 px-2 py-2 text-xs font-bold"><Share2 size={14} /></button></div>)}</div> : <div className="fm-card p-4 text-sm text-muted-foreground">No files received yet.</div>}</section></main><Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}><DialogContent className="h-[88vh] w-[94vw] max-w-3xl rounded-2xl"><DialogHeader><DialogTitle>{viewing?.title || "Invoice"}</DialogTitle></DialogHeader>{viewing && <iframe title={viewing.title} srcDoc={viewing.html} className="min-h-0 flex-1 rounded-xl border border-border bg-white" />}</DialogContent></Dialog></Layout>;
}