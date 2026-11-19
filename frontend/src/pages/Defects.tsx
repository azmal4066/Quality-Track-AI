import { useEffect, useState } from "react";
import { api } from "../services/api";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Badge, Empty, PageHeader, Skeleton } from "../components/ui";

const STATUSES = ["open", "under_review", "resolved", "closed"];
const PAGE = 15;

export default function Defects() {
  const { can } = useAuth(); const { notify } = useToast();
  const [data, setData] = useState<{ items: any[]; total: number } | null>(null);
  const [f, setF] = useState({ q: "", status: "", severity: "" });
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState({ by: "created_at", desc: true });
  const [people, setPeople] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);
  useEffect(() => { supabase.from("profiles").select("id,full_name,email").eq("is_active", true).then(({ data }) => setPeople(data ?? [])); }, []);

  const load = () => {
    const p = new URLSearchParams({ limit: String(PAGE), offset: String(page * PAGE), sort: sort.by, desc: String(sort.desc) });
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    api.get<{ items: any[]; total: number }>(`/api/defects?${p}`).then(setData).catch(e => { notify("error", e.message); setData({ items: [], total: 0 }); });
  };
  useEffect(() => { setData(null); load(); }, [f, page, sort]); // eslint-disable-line

  const update = async (id: string, body: object) => { try { await api.put(`/api/defects/${id}`, body); notify("success", "Defect updated"); load(); } catch (e) { notify("error", e instanceof Error ? e.message : "Update failed"); } };
  const staff = can("super_admin", "admin", "inspector");
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <>
      <PageHeader title="Defect Management" subtitle="Track each detected defect from open to closed." />
      <div className="card">
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <input className="input max-w-xs" placeholder="Search defect type" aria-label="Search defect type" value={f.q} onChange={e => { setPage(0); setF({ ...f, q: e.target.value }); }} />
          <select className="input max-w-[11rem]" aria-label="Filter by status" value={f.status} onChange={e => { setPage(0); setF({ ...f, status: e.target.value }); }}><option value="">All statuses</option>{STATUSES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
          <select className="input max-w-[11rem]" aria-label="Filter by severity" value={f.severity} onChange={e => { setPage(0); setF({ ...f, severity: e.target.value }); }}><option value="">All severities</option>{["low", "medium", "high", "critical"].map(s => <option key={s}>{s}</option>)}</select>
        </div>
        {!data ? <div className="space-y-3 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div> :
          data.items.length === 0 ? <Empty title="No defects found" text="Defects are created automatically when an inspection detects them." /> : (
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="text-xs text-mute"><tr><th className="p-4">ID</th>{([["defect_type", "Type"], ["", "Product"], ["severity", "Severity"], ["confidence", "Confidence"], ["status", "Status"]] as const).map(([k, l]) => <th key={l}>{k ? <button className="font-semibold" onClick={() => setSort(s => ({ by: k, desc: s.by === k ? !s.desc : true }))}>{l}{sort.by === k ? (sort.desc ? " ↓" : " ↑") : ""}</button> : l}</th>)}<th>Assigned to</th><th>Corrective action</th></tr></thead>
              <tbody className="divide-y divide-line">{data.items.map(d => (
                <tr key={d.id}>
                  <td className="p-4 font-mono text-xs text-mute" title={d.id}>{d.id.slice(0, 8)}</td>
                  <td className="font-semibold">{d.defect_type}</td>
                  <td className="font-mono text-xs text-mute">{d.inspections?.products?.product_code ?? "-"}</td>
                  <td>{staff ? <select aria-label="Severity" className="input !w-28 !py-1.5" value={d.severity} onChange={e => update(d.id, { severity: e.target.value })}>{["low", "medium", "high", "critical"].map(s => <option key={s}>{s}</option>)}</select> : <Badge value={d.severity} />}</td>
                  <td className="font-mono text-xs">{d.confidence != null ? `${(d.confidence * 100).toFixed(0)}%` : "-"}</td>
                  <td>{staff ? <select aria-label="Status" className="input !w-36 !py-1.5" value={d.status} onChange={e => update(d.id, { status: e.target.value })}>{STATUSES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select> : <Badge value={d.status} />}</td>
                  <td>{staff ? <select aria-label="Assign to" className="input !w-40 !py-1.5" value={d.assigned_to ?? ""} onChange={e => update(d.id, { assigned_to: e.target.value || null })}><option value="">Unassigned</option>{people.map(p => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}</select> : (d.assignee?.full_name ?? "-")}</td>
                  <td className="pr-4">{staff ? <input className="input !py-1.5" defaultValue={d.corrective_action ?? ""} placeholder="Add action" aria-label="Corrective action" onBlur={e => e.target.value !== (d.corrective_action ?? "") && update(d.id, { corrective_action: e.target.value })} /> : (d.corrective_action ?? "-")}</td>
                </tr>))}</tbody>
            </table></div>)}
        <div className="flex items-center justify-between border-t border-line p-4 text-sm text-mute">
          <span>{data?.total ?? 0} defects</span>
          <div className="flex items-center gap-2"><button className="btn-ghost !py-1.5" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button><span>{page + 1} / {pages}</span><button className="btn-ghost !py-1.5" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>Next</button></div>
        </div>
      </div>
    </>
  );
}
