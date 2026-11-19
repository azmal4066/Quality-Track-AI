import { useEffect, useState } from "react";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { api, downloadPost } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Empty, PageHeader } from "../components/ui";

type R = { id: string; report_type: string; inspection_id: string | null; created_at: string };
type Ins = { id: string; batch_number: string | null; status: string; created_at: string };

export default function Reports() {
  const { can } = useAuth(); const { notify } = useToast();
  const staff = can("super_admin", "admin", "inspector");
  const [recent, setRecent] = useState<R[]>([]);
  const [ins, setIns] = useState<Ins[]>([]);
  const [iid, setIid] = useState(""); const [batch, setBatch] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState<string | null>(null);

  const loadRecent = () => staff && api.get<R[]>("/api/reports/recent").then(setRecent).catch(() => {});
  useEffect(() => { if (staff) api.get<Ins[]>("/api/inspection/history?limit=100").then(setIns).catch(e => notify("error", e.message)); loadRecent(); }, []); // eslint-disable-line

  const run = async (key: string, body: object, name: string) => {
    setBusy(key);
    try { await downloadPost("/api/reports/generate", body, name); notify("success", "Report downloaded"); loadRecent(); }
    catch (e) { notify("error", e instanceof Error ? e.message : "Report failed"); }
    finally { setBusy(null); }
  };
  const batches = [...new Set(ins.map(i => i.batch_number).filter(Boolean))] as string[];
  if (!staff) return <><PageHeader title="Reports" /><div className="card"><Empty title="Not available" text="Your role cannot generate reports." /></div></>;

  return (
    <>
      <PageHeader title="Reports" subtitle="PDF and CSV reports generated from stored inspection records." />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3 p-5">
          <h2 className="font-bold">Individual inspection (PDF)</h2>
          <select className="input" value={iid} onChange={e => setIid(e.target.value)} aria-label="Inspection">
            <option value="">Select inspection</option>
            {ins.map(i => <option key={i.id} value={i.id}>{i.id.slice(0, 8)} · {i.status} · {i.created_at.slice(0, 10)}</option>)}
          </select>
          <button className="btn-primary" disabled={!iid || busy === "i"} onClick={() => run("i", { type: "inspection", inspection_id: iid }, "inspection.pdf")}><FileDown className="h-4 w-4" />Download PDF</button>
        </div>
        <div className="card space-y-3 p-5">
          <h2 className="font-bold">Batch report (PDF)</h2>
          <select className="input" value={batch} onChange={e => setBatch(e.target.value)} aria-label="Batch">
            <option value="">Select batch</option>{batches.map(b => <option key={b}>{b}</option>)}
          </select>
          <button className="btn-primary" disabled={!batch || busy === "b"} onClick={() => run("b", { type: "batch", batch_number: batch }, "batch.pdf")}><FileDown className="h-4 w-4" />Download PDF</button>
        </div>
        <div className="card space-y-3 p-5">
          <h2 className="font-bold">Monthly quality report (PDF)</h2>
          <input type="month" className="input" value={month} onChange={e => setMonth(e.target.value)} aria-label="Month" />
          <button className="btn-primary" disabled={!month || busy === "m"} onClick={() => run("m", { type: "monthly", month }, "monthly.pdf")}><FileDown className="h-4 w-4" />Download PDF</button>
        </div>
        <div className="card space-y-3 p-5">
          <h2 className="font-bold">CSV export</h2>
          <p className="text-xs text-mute">Uses the batch and month selected in the other cards (leave empty for all inspections).</p>
          <button className="btn-ghost" disabled={busy === "c"} onClick={() => run("c", { type: "csv", batch_number: batch || null, month: month || null }, "inspections.csv")}><FileSpreadsheet className="h-4 w-4" />Download CSV</button>
        </div>
      </div>
      <div className="card mt-6">
        <h2 className="border-b border-line p-4 font-bold">Recently generated</h2>
        {recent.length === 0 ? <Empty title="No reports yet" text="Generated reports appear here." /> :
          <ul className="divide-y divide-line text-sm">{recent.map(r => <li key={r.id} className="flex justify-between p-4"><span className="font-semibold">{r.report_type}</span><span className="text-mute">{new Date(r.created_at).toLocaleString()}</span></li>)}</ul>}
      </div>
    </>
  );
}
