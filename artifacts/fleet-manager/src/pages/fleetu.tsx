import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/role";
import { askFleetu, type FleetuMessage } from "@/lib/workspace";
import { Bot, LockKeyhole, Send, ShieldCheck, Sparkles, UserRound, WandSparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type DisplayMessage = FleetuMessage & { id: string };

const ownerSuggestions = [
  "Summarize my fleet status",
  "Which connected drivers need attention?",
  "What work logs or payments need follow-up?",
];
const driverSuggestions = [
  "Verify my recent work logs",
  "What is my current payment status?",
  "Do I have any open maintenance requests?",
];

export default function Fleetu() {
  const { session } = useAuth();
  const { role } = useRole();
  const owner = role === "owner";
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const suggestions = owner ? ownerSuggestions : driverSuggestions;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const sendMessage = async (text = input) => {
    const question = text.trim();
    if (!question || !session || busy) return;
    setInput("");
    setError("");
    const userMessage: DisplayMessage = { id: crypto.randomUUID(), role: "user", text: question };
    const history = messages.map(({ role: messageRole, text }) => ({ role: messageRole, text }));
    setMessages((current) => [...current, userMessage]);
    setBusy(true);
    try {
      const answer = await askFleetu(session.access_token, question, history);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "model", text: answer }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Fleetu could not answer right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <div className="fm-fleetu-page">
        <header className="fm-fleetu-header">
          <div className="flex items-center gap-3">
            <div className="fm-fleetu-mark"><Sparkles size={22} /></div>
            <div><p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">Fleetvix intelligence</p><h1 className="text-2xl font-black">Fleetu</h1><p className="text-xs text-muted-foreground">Your private fleet assistant</p></div>
          </div>
          <div className="fm-fleetu-scope"><LockKeyhole size={13} />{owner ? "Owner scope" : "Driver scope"}</div>
        </header>
        <div className="fm-fleetu-content">
          <section className="fm-fleetu-intro">
            <div className="fm-fleetu-intro-icon"><WandSparkles size={26} /></div>
            <div><h2>{owner ? "Ask about your fleet" : "Verify your records"}</h2><p>{owner ? "Fleetu can read your workspace and connected driver records to help you make decisions." : "Fleetu can check only the records visible in your Driver interface. Owner and other-driver information stays private."}</p></div>
          </section>
          <div className="fm-fleetu-suggestions">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void sendMessage(suggestion)} disabled={busy}>{suggestion}</button>)}</div>
          <div className="fm-fleetu-thread" aria-live="polite">
            {!messages.length && <div className="fm-fleetu-empty"><Bot size={38} /><h3>How can I help?</h3><p>Ask a question below or choose a prompt to get started.</p></div>}
            {messages.map((message) => <div key={message.id} className={`fm-fleetu-message ${message.role === "user" ? "is-user" : "is-model"}`}><div className="fm-fleetu-avatar">{message.role === "user" ? <UserRound size={15} /> : <Bot size={15} />}</div><div><span className="fm-fleetu-message-label">{message.role === "user" ? "You" : "Fleetu"}</span><p>{message.text}</p></div></div>)}
            {busy && <div className="fm-fleetu-message is-model"><div className="fm-fleetu-avatar"><Bot size={15} /></div><div><span className="fm-fleetu-message-label">Fleetu</span><p className="animate-pulse">Checking your Fleetvix records…</p></div></div>}
            <div ref={bottomRef} />
          </div>
          {error && <div className="fm-fleetu-error">{error}</div>}
          <form className="fm-fleetu-composer" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={owner ? "Ask about vehicles, drivers, logs or payments…" : "Ask Fleetu to verify your own records…"} maxLength={2000} disabled={busy} />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send message"><Send size={18} /></button>
          </form>
          <div className="fm-fleetu-privacy"><ShieldCheck size={14} />{owner ? "Fleetu is limited to your authenticated Fleetvix workspace." : "Driver privacy boundary: Fleetu cannot access owner-only or other-driver information."}</div>
        </div>
      </div>
    </Layout>
  );
}