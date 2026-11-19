import { useState } from "react";
import { Loader2, Layers, Download } from "lucide-react";
import { api, ApiError } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import { Badge, PageHeader } from "../components/ui";
import { toCsv } from "../utils/stats";
import type { InspectionResult } from "../types";

type Item = { filename: string; ok: boolean; error?: string } & Partial<InspectionResult>;
const OK = ["image/jpeg", "image/png", "image/webp"];

export default function Batch() {
  const { notify } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [batch, setBatch] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [sort, setSort] = useState<"order" | "defects">("order");

  const run = async () => {
    setBusy(true); setItems([]);
    const done: Item[] = [];
    for (const f of files) {
      try {
        if (!OK.includes(f.type)) throw new Error("Unsupported format");
        const fd = new FormData(); fd.append("file", f); fd.append("batch_number", batch);
        done.push({ filename: f.name, ok: true, ...(await api.upload<InspectionResult>("/api/inspection/analyze", fd)) });
      } catch (e) {
        if (e instanceof ApiError && e.status === 503) { notify("error", e.message); done.push({ filename: f.name, ok: false, error: e.message }); setItems([...done]); break; }
        done.push({ filename: f.name, ok: false, error: e instanceof Error ? e.message : "Failed" });
      }
      setItems([...done]);
    }
    try { const fd = new FormData(); fd.append("batch_number", batch); await api.upload("/api/inspection/batch/finalize", fd); } catch { /* counters refresh next run */ }
    const okN = done.filter(d => d.ok).length;
    notify(okN === done.length && done.length === files.length ? "success" : "error", `${okN} of ${files.length} images inspected`);
    setBusy(false);
  };

  const shown = sort === "defects" ? [...items].sort((a, b) => (b.defect_count ?? -1) - (a.defect_count ?? -1)) : items;
  const count = (s: string) => items.filter(i => i.status === s).length;
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv([["file", "ok", "status", "defects", "quality_score", "error"], ...items.map(i => [i.filename, i.ok, i.status, i.defect_count, i.quality_score, i.error])])], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: `batch-${batch}.csv` }).click();
  };

  return (
    <>
      <PageHeader title="Batch Inspection" subtitle="Up to 50 images. Each is sent to the YOLO model and saved individually." />
      <div className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="b">Batch number</label><input id="b" className="input" value={batch} onChange={e => setBatch(e.target.value)} /></div>
          <div><label className="label" htmlFor="f">Images</label><input id="f" type="file" multiple accept=".jpg,.jpeg,.png,.webp" className="input" onChange={e => setFiles(Array.from(e.target.files ?? []).slice(0, 50))} /></div>
        </div>
        <button className="btn-primary" disabled={!batch || !files.length || busy} onClick={run}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" />Processing {items.length} / {files.length}</> : <><Layers className="h-4 w-4" />Inspect {files.length || ""} images</>}</button>
        {(busy || items.length > 0) && <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={items.length} aria-valuemax={files.length}><div className="h-full bg-brand transition-all" style={{ width: `${(items.length / Math.max(files.length, 1)) * 100}%` }} /></div>}
      </div>
      {items.length > 0 && (
        <div className="card mt-6 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">Batch {batch}: {count("PASS")} pass · {count("REVIEW")} review · {count("FAIL")} fail · {items.filter(i => !i.ok).length} errors</h2>
            <div className="flex gap-2"><select className="input !w-40 !py-1.5" aria-label="Sort" value={sort} onChange={e => setSort(e.target.value as any)}><option value="order">Upload order</option><option value="defects">Most defects first</option></select>
              <button className="btn-ghost" onClick={exportCsv}><Download className="h-4 w-4" />CSV</button></div>
          </div>
          <ul className="divide-y divide-line text-sm">{shown.map((i, n) => (
            <li key={n} className="flex items-center justify-between py-2"><span>{i.filename}</span>{i.ok ? <span className="flex items-center gap-3"><span className="font-mono text-xs text-mute">{i.defect_count} defects · score {i.quality_score}</span><Badge value={i.status!} /></span> : <span className="text-xs text-bad">{i.error}</span>}</li>))}</ul>
        </div>
      )}
    </>
  );
}
