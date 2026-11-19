import { useRef, useEffect, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { api } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import { PageHeader } from "../components/ui";

type M = { role: "user" | "assistant"; content: string };
const IDEAS = ["Summarize our inspection results", "Which defect types are most frequent?", "Suggest general corrective actions for cracks", "How do I export a batch report?"];

export default function Assistant() {
  const { notify } = useToast();
  const [msgs, setMsgs] = useState<M[]>([]);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);

  const send = async (content: string) => {
    if (!content.trim() || busy) return;
    const next: M[] = [...msgs, { role: "user", content }];
    setMsgs(next); setText(""); setBusy(true);
    try { const r = await api.post<{ reply: string }>("/api/assistant/chat", { messages: next.slice(-20) }); setMsgs([...next, { role: "assistant", content: r.reply }]); }
    catch (e) { notify("error", e instanceof Error ? e.message : "Assistant failed"); setMsgs(msgs); }
    finally { setBusy(false); }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); send(text); };

  return (
    <>
      <PageHeader title="AI Assistant" subtitle="Answers use your stored inspection data. It cannot see or inspect images." />
      <div className="card flex h-[calc(100vh-14rem)] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {msgs.length === 0 && <div className="flex flex-wrap gap-2">{IDEAS.map(i => <button key={i} className="btn-ghost !text-xs" onClick={() => send(i)}>{i}</button>)}</div>}
          {msgs.map((m, i) => <div key={i} className={m.role === "user" ? "ml-auto max-w-[80%] rounded-2xl bg-brand px-4 py-2.5 text-sm text-white" : "max-w-[85%] whitespace-pre-wrap rounded-2xl bg-line/50 px-4 py-2.5 text-sm"}>{m.content}</div>)}
          {busy && <div className="skeleton h-10 w-40" />}
          <div ref={end} />
        </div>
        <form onSubmit={submit} className="flex gap-2 border-t border-line p-3">
          <input className="input" value={text} onChange={e => setText(e.target.value)} placeholder="Ask about defects, results or the app" aria-label="Message" maxLength={4000} />
          <button className="btn-primary" disabled={busy || !text.trim()} aria-label="Send"><Send className="h-4 w-4" /></button>
        </form>
      </div>
    </>
  );
}
