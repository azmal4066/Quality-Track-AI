import { useEffect, useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, Search, History as HistoryIcon } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Badge, Confirm, Empty, Modal, PageHeader, Skeleton } from "../components/ui";

type P = { id: string; product_code: string; name: string; category?: string; description?: string; manufacturing_date?: string; image_signed?: string | null };

export default function Products() {
  const { can } = useAuth(); const { notify } = useToast();
  const [items, setItems] = useState<P[] | null>(null);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Partial<P> | null>(null);
  const [del, setDel] = useState<P | null>(null);
  const [hist, setHist] = useState<{ p: P; rows: any[] } | null>(null);
  const openHist = async (p: P) => { try { setHist({ p, rows: await api.get<any[]>(`/api/products/${p.id}/inspections`) }); } catch (e) { notify("error", e instanceof Error ? e.message : "Failed"); } };
  const load = () => api.get<P[]>("/api/products").then(setItems).catch(e => { notify("error", e.message); setItems([]); });
  useEffect(() => { load(); }, []); // eslint-disable-line

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget); const img = fd.get("image"); fd.delete("image");
    const f = Object.fromEntries(fd) as Record<string, string>;
    Object.keys(f).forEach(k => f[k] === "" && delete f[k]);
    try {
      const saved: any = edit?.id ? await api.put(`/api/products/${edit.id}`, f) : await api.post("/api/products", f);
      if (img instanceof File && img.size > 0) { const up = new FormData(); up.append("file", img); await api.upload(`/api/products/${saved.id}/image`, up); }
      notify("success", edit?.id ? "Product updated" : "Product added"); setEdit(null); load();
    } catch (err) { notify("error", err instanceof Error ? err.message : "Save failed"); }
  };
  const remove = async (p: P) => { try { await api.del(`/api/products/${p.id}`); notify("success", "Product deleted"); load(); } catch (e) { notify("error", e instanceof Error ? e.message : "Delete failed"); } };
  const shown = (items ?? []).filter(p => `${p.name} ${p.product_code}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader title="Products" subtitle="Items you inspect. Link inspections by product ID."
        actions={can("super_admin", "admin", "inspector") ? <button className="btn-primary" onClick={() => setEdit({})}><Plus className="h-4 w-4" />Add product</button> : null} />
      <div className="card">
        <div className="border-b border-line p-4"><div className="relative max-w-sm"><Search className="absolute left-3 top-3 h-4 w-4 text-mute" /><input className="input pl-9" placeholder="Search products" value={q} onChange={e => setQ(e.target.value)} aria-label="Search products" /></div></div>
        {!items ? <div className="space-y-3 p-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div> :
          shown.length === 0 ? <Empty title="No products" text="Add a product so inspections can be linked to it." /> : (
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="text-xs text-mute"><tr><th className="p-4">Code</th><th>Name</th><th>Category</th><th>Manufactured</th><th /></tr></thead>
              <tbody className="divide-y divide-line">{shown.map(p => (
                <tr key={p.id}><td className="p-4 font-mono text-xs">{p.image_signed && <img src={p.image_signed} alt="" className="mb-1 h-10 w-10 rounded-lg object-cover" />}{p.product_code}</td><td className="font-semibold">{p.name}</td><td className="text-mute">{p.category ?? "-"}</td><td className="text-mute">{p.manufacturing_date ?? "-"}</td>
                  <td className="space-x-1 pr-4 text-right"><button className="btn-ghost !p-2" aria-label={`History for ${p.name}`} onClick={() => openHist(p)}><HistoryIcon className="h-4 w-4" /></button>{can("super_admin", "admin", "inspector") && <button className="btn-ghost !p-2" aria-label={`Edit ${p.name}`} onClick={() => setEdit(p)}><Pencil className="h-4 w-4" /></button>}
                    {can("super_admin", "admin") && <button className="btn-danger !p-2" aria-label={`Delete ${p.name}`} onClick={() => setDel(p)}><Trash2 className="h-4 w-4" /></button>}</td></tr>))}</tbody>
            </table></div>)}
      </div>
      <Modal open={!!edit} title={edit?.id ? "Edit product" : "Add product"} onClose={() => setEdit(null)}>
        <form onSubmit={save} className="space-y-3" key={edit?.id ?? "new"}>
          <div><label className="label" htmlFor="pc">Product ID</label><input id="pc" name="product_code" required className="input" defaultValue={edit?.product_code} /></div>
          <div><label className="label" htmlFor="pn">Name</label><input id="pn" name="name" required className="input" defaultValue={edit?.name} /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="pcat">Category</label><input id="pcat" name="category" className="input" defaultValue={edit?.category} /></div>
            <div><label className="label" htmlFor="pm">Manufacturing date</label><input id="pm" name="manufacturing_date" type="date" className="input" defaultValue={edit?.manufacturing_date} /></div></div>
          <div><label className="label" htmlFor="pd">Description</label><textarea id="pd" name="description" rows={2} className="input" defaultValue={edit?.description} /></div>
          <div><label className="label" htmlFor="pi">Image (JPG, PNG, WEBP)</label><input id="pi" name="image" type="file" accept=".jpg,.jpeg,.png,.webp" className="input" /></div>
          <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary">Save product</button></div>
        </form>
      </Modal>
      <Modal open={!!hist} title={`Inspections: ${hist?.p.name ?? ""}`} onClose={() => setHist(null)}>
        {hist?.rows.length ? <ul className="max-h-80 divide-y divide-line overflow-y-auto text-sm">{hist.rows.map(r => <li key={r.id} className="flex items-center justify-between py-2"><span className="text-mute">{new Date(r.created_at).toLocaleString()} · {r.batch_number ?? "no batch"}</span><span className="flex items-center gap-2"><span className="font-mono text-xs">{r.defect_count} defects</span><Badge value={r.status} /></span></li>)}</ul> : <p className="text-sm text-mute">No inspections linked to this product yet.</p>}
      </Modal>
      <Confirm open={!!del} title="Delete product" text={`Delete ${del?.name}? Existing inspections stay but lose the product link.`} confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => del && remove(del)} />
    </>
  );
}
