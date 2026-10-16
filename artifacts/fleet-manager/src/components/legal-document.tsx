import { getGetPublicLegalContentQueryKey, useGetPublicLegalContent, type SiteContent } from "@workspace/api-client-react";
import { ArrowLeft, ArrowUpRight, FileText, LockKeyhole, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import type { ReactNode } from "react";

type LegalKind = "terms" | "privacy";

function interpolate(content: string, site: SiteContent) {
  const values: Record<string, string> = {
    termsUpdatedAt: site.termsUpdatedAt,
    privacyUpdatedAt: site.privacyUpdatedAt,
    legalName: site.legalName,
    businessAddress: site.businessAddress,
    supportEmail: site.supportEmail,
    privacyEmail: site.privacyEmail,
    supportPhone: site.supportPhone,
  };
  return content.replace(/\{\{(termsUpdatedAt|privacyUpdatedAt|legalName|businessAddress|supportEmail|privacyEmail|supportPhone)\}\}/g, (_, key: string) => values[key] || "");
}

function inlineMarkdown(text: string): ReactNode[] {
  const pattern = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;
  return text.split(pattern).filter(Boolean).map((part, index) => {
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const safeUrl = /^(https?:|mailto:)/i.test(linkMatch[2]) ? linkMatch[2] : "";
      return safeUrl ? <a key={index} href={safeUrl} target={safeUrl.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="font-semibold text-primary underline underline-offset-4">{linkMatch[1]}</a> : <span key={index}>{linkMatch[1]}</span>;
    }
    if (/^\*\*.*\*\*$|^__.*__$/.test(part)) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (/^\*.*\*$|^_.*_$/.test(part)) return <em key={index}>{part.slice(1, -1)}</em>;
    if (/^`.*`$/.test(part)) return <code key={index} className="rounded bg-muted px-1.5 py-0.5 text-[0.9em]">{part.slice(1, -1)}</code>;
    return <span key={index}>{part}</span>;
  });
}

function MarkdownBody({ source }: { source: string }) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let ordered = false;
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(<p key={`p-${blocks.length}`}>{inlineMarkdown(paragraph.join(" "))}</p>);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (!list.length) return;
    const Tag = ordered ? "ol" : "ul";
    blocks.push(<Tag key={`list-${blocks.length}`}>{list.map((item, index) => <li key={index}>{inlineMarkdown(item)}</li>)}</Tag>);
    list = [];
  };
  lines.forEach((line) => {
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const number = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (!line.trim()) { flushParagraph(); flushList(); return; }
    if (heading) {
      flushParagraph(); flushList();
      const level = heading[1].length;
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
      blocks.push(<Tag key={`h-${blocks.length}`}>{inlineMarkdown(heading[2])}</Tag>);
      return;
    }
    if (bullet || number) {
      flushParagraph();
      const nextOrdered = Boolean(number);
      if (list.length && ordered !== nextOrdered) flushList();
      ordered = nextOrdered;
      list.push((bullet || number)![1]);
      return;
    }
    flushList();
    paragraph.push(line.trim());
  });
  flushParagraph();
  flushList();
  return <div className="fm-legal-prose">{blocks}</div>;
}

export function LegalDocumentPage({ kind }: { kind: LegalKind }) {
  const { data, isLoading, isError, refetch } = useGetPublicLegalContent({
    query: { queryKey: getGetPublicLegalContentQueryKey() },
  });
  const content = data?.content;
  const title = kind === "terms" ? "Terms & Conditions" : "Privacy Policy";
  const body = content ? interpolate(kind === "terms" ? content.termsContent : content.privacyContent, content) : "";
  const Icon = kind === "terms" ? FileText : LockKeyhole;
  return (
    <main className="fm-legal-page">
      <header className="fm-legal-header">
        <Link href="/" className="fm-legal-brand"><span className="fm-legal-mark"><ShieldCheck size={19} /></span><span>Fleetvix<span className="fm-legal-brand-sub">FIELD OPERATIONS</span></span></Link>
        <a href={new URL(import.meta.env.BASE_URL || "/", window.location.origin).toString()} aria-label="Back to sign in" className="fm-legal-back"><ArrowLeft size={16} /> Back</a>
      </header>
      <div className="fm-legal-wrap">
        <div className="fm-legal-kicker"><Icon size={15} /> PUBLIC DOCUMENT</div>
        <h1>{title}</h1>
        <p className="fm-legal-deck">The information that governs how Fleetvix works with your business and your data.</p>
        {isLoading ? (
          <div className="fm-legal-loading" aria-label="Loading document"><div /><div /><div /><div /></div>
        ) : isError ? (
          <div className="fm-legal-message"><p>We could not load this document right now.</p><button type="button" onClick={() => void refetch()}>Try again</button></div>
        ) : content ? (
          <article className="fm-legal-paper">
            <div className="fm-legal-meta"><span>Effective date</span><strong>{kind === "terms" ? content.termsUpdatedAt : content.privacyUpdatedAt}</strong></div>
            <MarkdownBody source={body} />
          </article>
        ) : (
          <div className="fm-legal-message">This document is not available yet.</div>
        )}
        {content && (
          <aside className="fm-legal-contact">
            <div><strong>Need help?</strong><span>Contact the Fleetvix team about this document.</span></div>
            <div className="flex min-w-0 flex-col gap-2 sm:items-end">
              {(kind === "terms" ? content.supportEmail : content.privacyEmail) && <a href={`mailto:${kind === "terms" ? content.supportEmail : content.privacyEmail}`}>{kind === "terms" ? content.supportEmail : content.privacyEmail}<ArrowUpRight size={14} /></a>}
              {content.supportPhone && <a href={`tel:${content.supportPhone}`}>{content.supportPhone}<ArrowUpRight size={14} /></a>}
            </div>
          </aside>
        )}
      </div>
      <footer className="fm-legal-footer"><span>Fleetvix · Dependable tools for the worksite</span><nav><Link href="/terms-and-conditions">Terms</Link><Link href="/privacy-policy">Privacy</Link></nav></footer>
    </main>
  );
}