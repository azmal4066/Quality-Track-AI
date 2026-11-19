import { useEffect, useState } from "react";
import { toCsv } from "../utils/stats";
import { api, downloadPost } from "../services/api";
import { supabase } from "../services/supabase";
import { useToast } from "../contexts/ToastContext";
import { Badge, Empty, Modal, PageHeader, Skeleton } from "../components/ui";

export default function History() {
  const { notify } = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [f, setF] = useState({ status: "", batch: "", date_from: "", date_to: "", product_code: "", defect_type: "", inspector_id: "" });
  const [open, setOpen] = useState<any | null>(null);
  const [people, setPeople] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  useEffect(() => {
    supabase.from("profiles").select("id,full_name,email").then(({ data }) => setPeople(data ?? []));
    api.get<{ defect_categories?: string[] }>("/api/settings").then(r => setCats(r.defect_categories ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    setRows(null);
    const p = new URLSearchParams({ limit: "100" }); Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    api.get<any[]>(`/api/inspection/history?${p}`).then(setRows).catch(e => { notify("error", e.message); setRows([]); });
  }, [f]); // eslint-disable-line

  const view = async (id: string) => { try { setOpen(await api.get(`/api/inspection/${id}`)); } catch (e) { notify("error", e instanceof Error ? e.message : "Could not load inspection"); } };
  const csv = () => {
    const lines = [["id", "date", "product", "batch", "status", "defects", "quality_score"], ...(rows ?? []).map(r => [r.id, r.created_at, r.products?.product_code ?? "", r.batch_number ?? "", r.status, r.defect_count, r.quality_score ?? ""])];
    const url = URL.createObjectURL(new Blob([toCsv(lines)], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: "inspections.csv" }).click();
  };

  return (
    <>
      <PageHeader title="Inspection History" subtitle="Every saved inspection, newest first." actions={<button className="btn-ghost" disabled={!rows?.length} onClick={csv}>Export CSV</button>} />
      <div className="card">
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <select className="input max-w-[11rem]" aria-label="Status" value={f.status} onChange={e => setF({ ...f, status: e.target.value })}><option value="">All statuses</option><option>PASS</option><option>FAIL</option><option>REVIEW</option></select>
          <input className="input max-w-xs" placeholder="Batch number" aria-label="Batch number" value={f.batch} onChange={e => setF({ ...f, batch: e.target.value })} />
          <input type="date" className="input max-w-[11rem]" aria-label="From date" value={f.date_from} onChange={e => setF({ ...f, date_from: e.target.value })} />
          <input type="date" className="input max-w-[11rem]" aria-label="To date" value={f.date_to} onChange={e => setF({ ...f, date_to: e.target.value })} />
          <input className="input max-w-[11rem]" placeholder="Product ID" aria-label="Product ID" value={f.product_code} onChange={e => setF({ ...f, product_code: e.target.value })} />
          <select className="input max-w-[12rem]" aria-label="Defect category" value={f.defect_type} onChange={e => setF({ ...f, defect_type: e.target.value })}><option value="">All defect types</option>{cats.map(c => <option key={c}>{c}</option>)}</select>
          <select className="input max-w-[12rem]" aria-label="Inspector" value={f.inspector_id} onChange={e => setF({ ...f, inspector_id: e.target.value })}><option value="">All inspectors</option>{people.map(p => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}</select>
          <button className="btn-ghost" onClick={() => setF({ status: "", batch: "", date_from: "", date_to: "", product_code: "", defect_type: "", inspector_id: "" })}>Clear</button>
        </div>
        {!rows ? <div className="space-y-3 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div> :
          rows.length === 0 ? <Empty title="No inspections" text="Nothing matches these filters yet." /> : (
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="text-xs text-mute"><tr><th className="p-4">Date</th><th>Product</th><th>Batch</th><th>Status</th><th>Defects</th><th>Quality</th><th /></tr></thead>
              <tbody className="divide-y divide-line">{rows.map(r => (
                <tr key={r.id}><td className="p-4 text-mute">{new Date(r.created_at).toLocaleString()}</td><td className="font-semibold">{r.products?.name ?? "-"}</td><td className="text-mute">{r.batch_number ?? "-"}</td><td><Badge value={r.status} /></td><td className="font-mono">{r.defect_count}</td><td className="font-mono">{r.quality_score ?? "-"}</td>
                  <td className="pr-4 text-right"><button className="btn-ghost !py-1.5" onClick={() => view(r.id)}>View</button></td></tr>))}</tbody>
            </table></div>)}
      </div>
      <Modal open={!!open} title="Inspection details" onClose={() => setOpen(null)}>
        {open && <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3"><Badge value={open.status} /><span className="text-mute">{new Date(open.created_at).toLocaleString()}</span></div>
          <div className="grid grid-cols-2 gap-3">{open.original_url && <a href={open.original_url} target="_blank" rel="noreferrer"><img src={open.original_url} alt="Original" className="rounded-xl" /></a>}{open.annotated_url && <a href={open.annotated_url} target="_blank" rel="noreferrer"><img src={open.annotated_url} alt="Annotated" className="rounded-xl" /></a>}</div>
          <ul className="divide-y divide-line">{open.defects.map((d: any) => <li key={d.id} className="flex justify-between py-1.5"><span>{d.defect_type}</span><span className="font-mono text-mute">{(d.confidence * 100).toFixed(0)}%</span></li>)}</ul>
          <p className="text-xs text-mute">Model {open.model_version}</p>
          <button className="btn-ghost" onClick={() => downloadPost("/api/reports/generate", { type: "inspection", inspection_id: open.id }, "inspection.pdf").catch(e => notify("error", e instanceof Error ? e.message : "Download failed"))}>Download PDF report</button>
        </div>}
      </Modal>
    </>
  );
}
