import { useEffect, useRef, useState, type DragEvent } from "react";
import { UploadCloud, Camera, Download, AlertOctagon, ScanSearch, Loader2 } from "lucide-react";
import { api, ApiError } from "../services/api";
import { supabase } from "../services/supabase";
import { useToast } from "../contexts/ToastContext";
import { Badge, PageHeader } from "../components/ui";
import type { InspectionResult, ModelStatus } from "../types";

const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 10;

export default function Inspect() {
  const { notify } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [model, setModel] = useState<ModelStatus | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [form, setForm] = useState({ product_code: "", category: "", batch_number: "", notes: "" });
  const [demoImg, setDemoImg] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<ModelStatus>("/api/model/status").then(setModel).catch(e => notify("error", `Backend unreachable: ${e.message}`));
    supabase.from("settings").select("value").eq("key", "product_categories").single().then(({ data }) => setCategories((data?.value as string[]) ?? []));
  }, []); // eslint-disable-line

  const pick = (f?: File) => {
    if (!f) return;
    if (!OK_TYPES.includes(f.type)) return notify("error", "Unsupported format. Use JPG, PNG or WEBP.");
    if (f.size > MAX_MB * 1024 * 1024) return notify("error", `File is larger than ${MAX_MB} MB.`);
    setFile(f); setResult(null); setPreview(URL.createObjectURL(f));
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); };

  const run = async () => {
    if (!file) return;
    setBusy(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (form.product_code) fd.append("product_code", form.product_code);
      if (form.batch_number) fd.append("batch_number", form.batch_number);
      if (form.notes) fd.append("notes", form.notes);
      const r = await api.upload<InspectionResult>("/api/inspection/analyze", fd);
      setResult(r); notify("success", `Inspection saved: ${r.status}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) setModel(m => ({ ...(m ?? { classes: [], model_version: "", setup_hint: null }), available: false, error: e.message, setup_hint: "Train or download weights and set YOLO_MODEL_PATH." }));
      notify("error", e instanceof Error ? e.message : "Inspection failed");
    } finally { setBusy(false); }
  };

  const runDemo = async () => {
    if (!file) return;
    setBusy(true); setDemoImg(null);
    try { const fd = new FormData(); fd.append("file", file); const r = await api.upload<{ annotated_data_url: string }>("/api/inspection/demo", fd); setDemoImg(r.annotated_data_url); }
    catch (e) { notify("error", e instanceof Error ? e.message : "Demo failed"); } finally { setBusy(false); }
  };
  const unavailable = model && !model.available;
  const set = (k: keyof typeof form) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <PageHeader title="AI Inspection" subtitle="Upload a product image. The trained YOLO model analyses it and the result is saved." />
      {unavailable && (
        <div className="mb-6 flex gap-3 rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm" role="alert">
          <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
          <div><p className="font-bold text-warn">AI model unavailable</p><p className="mt-1 text-mute">{model?.error} {model?.setup_hint} No detections will be produced until weights are loaded. See README, section "Train the model".</p></div>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-2">
          <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
            onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && input.current?.click()}
            className={`card flex min-h-64 cursor-pointer flex-col items-center justify-center border-2 border-dashed p-6 text-center transition-colors ${drag ? "border-brand bg-brand/10" : ""}`}>
            {preview ? <img src={preview} alt="Selected product" className="max-h-72 rounded-xl object-contain" /> : (<>
              <UploadCloud className="mb-3 h-8 w-8 text-brand" /><p className="font-bold">Drop an image here, or browse</p><p className="mt-1 text-xs text-mute">JPG, PNG or WEBP, up to {MAX_MB} MB</p></>)}
            <input ref={input} type="file" accept=".jpg,.jpeg,.png,.webp" hidden onChange={e => pick(e.target.files?.[0])} />
          </div>
          <label className="btn-ghost w-full cursor-pointer sm:hidden"><Camera className="h-4 w-4" />Take photo with camera
            <input type="file" accept="image/*" capture="environment" hidden onChange={e => pick(e.target.files?.[0])} /></label>
          <div className="card space-y-3 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label" htmlFor="pc">Product ID</label><input id="pc" className="input" value={form.product_code} onChange={set("product_code")} placeholder="e.g. DEMO-001" /></div>
              <div><label className="label" htmlFor="cat">Category</label>
                <select id="cat" className="input" value={form.category} onChange={set("category")}><option value="">Select...</option>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
            </div>
            <div><label className="label" htmlFor="bn">Batch number</label><input id="bn" className="input" value={form.batch_number} onChange={set("batch_number")} /></div>
            <div><label className="label" htmlFor="ds">Description (optional)</label><textarea id="ds" rows={2} className="input" value={form.notes} onChange={set("notes")} /></div>
            <button className="btn-primary w-full" disabled={!file || busy || !!unavailable} onClick={run}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Analysing...</> : <><ScanSearch className="h-4 w-4" />Start AI inspection</>}
            </button>
            {unavailable && model?.demo_enabled && <button className="btn-ghost w-full" disabled={!file || busy} onClick={runDemo}>Preview DEMO output (not a real prediction)</button>}
          </div>
        </div>

        <div className="xl:col-span-3">
          {demoImg ? (
            <div className="card space-y-3 border-warn/40 p-5"><p className="rounded-xl bg-warn/10 p-3 text-sm font-bold text-warn">DEMO MODE: placeholder output. No model ran and nothing was saved.</p><img src={demoImg} alt="Demo placeholder output" className="w-full rounded-xl" /></div>
          ) : !result ? (
            <div className="card flex h-full min-h-64 items-center justify-center p-8 text-center text-sm text-mute">{busy ? "Running the model on your image..." : "Results appear here after an inspection."}</div>
          ) : (
            <div className="card space-y-5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3"><Badge value={result.status} /><span className="text-sm text-mute">{new Date().toLocaleString()}</span></div>
                {result.annotated_url && <a className="btn-ghost" href={result.annotated_url} download="annotated.jpg" target="_blank" rel="noreferrer"><Download className="h-4 w-4" />Annotated image</a>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <figure><figcaption className="label">Original</figcaption>{result.original_url && <img src={result.original_url} alt="Original" className="w-full rounded-xl" />}</figure>
                <figure><figcaption className="label">Annotated</figcaption>{result.annotated_url && <img src={result.annotated_url} alt="Annotated with detections" className="w-full rounded-xl" />}</figure>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-bg p-3"><p className="font-mono text-2xl font-semibold">{result.defect_count}</p><p className="text-xs text-mute">Defects</p></div>
                <div className="rounded-xl bg-bg p-3"><p className="font-mono text-2xl font-semibold">{result.max_confidence != null ? `${(result.max_confidence * 100).toFixed(0)}%` : "-"}</p><p className="text-xs text-mute">Top model confidence</p></div>
                <div className="rounded-xl bg-bg p-3"><p className="font-mono text-2xl font-semibold">{result.quality_score}</p><p className="text-xs text-mute">Quality score</p></div>
              </div>
              <p className="text-xs text-mute">Model confidence is how sure the detector is about a box. Quality score is a derived 0-100 product score. They are different measures.</p>
              {result.detections.length === 0 ? <p className="rounded-xl bg-ok/10 p-3 text-sm text-ok">The model found no defects in the classes it was trained on.</p> : (
                <ul className="divide-y divide-line text-sm">{result.detections.map((d, i) => (
                  <li key={i} className="flex justify-between py-2"><span className="font-semibold">{d.label}</span><span className="font-mono text-mute">{(d.confidence * 100).toFixed(1)}%</span></li>))}</ul>)}
              <p className="text-xs text-mute">Model version: {result.model_version}. Summary: {result.defect_count === 0 ? "No defects detected." : `${result.defect_count} defect(s): ${[...new Set(result.detections.map(d => d.label))].join(", ")}.`}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
