import { useEffect, useState, type FormEvent } from "react";
import { UserPlus, Activity } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Badge, Empty, Modal, PageHeader, Skeleton } from "../components/ui";
import type { Role } from "../types";

type E = { id: string; full_name: string | null; email: string | null; role: Role; is_active: boolean; inspections: number };
type Act = { inspections: { id: string; status: string; batch_number: string | null; created_at: string }[]; audit: { action: string; created_at: string }[] };
const ROLES: Role[] = ["super_admin", "admin", "inspector", "viewer"];

export default function Employees() {
  const { profile } = useAuth(); const { notify } = useToast();
  const [items, setItems] = useState<E[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [tempPw, setTempPw] = useState<string | null>(null);
  const [view, setView] = useState<{ e: E; a: Act } | null>(null);
  const load = () => api.get<E[]>("/api/employees").then(setItems).catch(e => { notify("error", e.message); setItems([]); });
  useEffect(() => { load(); }, []); // eslint-disable-line

  const patch = async (e: E, body: object, ok: string) => {
    try { await api.put(`/api/employees/${e.id}`, body); notify("success", ok); load(); }
    catch (err) { notify("error", err instanceof Error ? err.message : "Update failed"); }
  };
  const create = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.currentTarget)) as Record<string, string>;
    if (!f.password) delete f.password;
    try { const r = await api.post<{ temporary_password: string | null }>("/api/employees", f); setAdding(false); setTempPw(r.temporary_password); notify("success", "Employee created"); load(); }
    catch (err) { notify("error", err instanceof Error ? err.message : "Create failed"); }
  };
  const open = async (e: E) => { try { setView({ e, a: await api.get<Act>(`/api/employees/${e.id}/activity`) }); } catch (err) { notify("error", err instanceof Error ? err.message : "Failed"); } };

  return (
    <>
      <PageHeader title="Employees" subtitle="Manage accounts, roles and activity." actions={<button className="btn-primary" onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" />Add employee</button>} />
      <div className="card overflow-x-auto">
        {!items ? <div className="space-y-3 p-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div> :
          items.length === 0 ? <Empty title="No employees" text="Add your first employee." /> :
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-mute"><tr><th className="p-4">Name</th><th>Email</th><th>Role</th><th>Inspections</th><th>Active</th><th /></tr></thead>
            <tbody className="divide-y divide-line">{items.map(e => {
              const self = e.id === profile?.id;
              return <tr key={e.id}>
                <td className="p-4 font-semibold">{e.full_name ?? "-"}</td><td className="text-mute">{e.email}</td>
                <td><select className="input !w-36 !py-1.5" value={e.role} disabled={self} aria-label={`Role for ${e.email}`} onChange={ev => patch(e, { role: ev.target.value }, "Role updated")}>
                  {ROLES.filter(r => r !== "super_admin" || profile?.role === "super_admin" || e.role === "super_admin").map(r => <option key={r}>{r}</option>)}</select></td>
                <td className="font-mono">{e.inspections}</td>
                <td><button className="disabled:opacity-50" disabled={self} onClick={() => patch(e, { is_active: !e.is_active }, e.is_active ? "Deactivated" : "Activated")}><Badge value={e.is_active ? "resolved" : "closed"} /></button></td>
                <td className="pr-4 text-right"><button className="btn-ghost !p-2" aria-label={`Activity for ${e.email}`} onClick={() => open(e)}><Activity className="h-4 w-4" /></button></td>
              </tr>; })}</tbody>
          </table>}
      </div>
      <Modal open={adding} title="Add employee" onClose={() => setAdding(false)}>
        <form onSubmit={create} className="space-y-3">
          <div><label className="label" htmlFor="en">Full name</label><input id="en" name="full_name" required className="input" /></div>
          <div><label className="label" htmlFor="ee">Email</label><input id="ee" name="email" type="email" required className="input" /></div>
          <div><label className="label" htmlFor="er">Role</label><select id="er" name="role" className="input" defaultValue="inspector">{ROLES.filter(r => r !== "super_admin" || profile?.role === "super_admin").map(r => <option key={r}>{r}</option>)}</select></div>
          <div><label className="label" htmlFor="ep">Password (blank = generate)</label><input id="ep" name="password" type="password" minLength={8} className="input" /></div>
          <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-ghost" onClick={() => setAdding(false)}>Cancel</button><button className="btn-primary">Create</button></div>
        </form>
      </Modal>
      <Modal open={!!tempPw} title="Temporary password" onClose={() => setTempPw(null)}>
        <p className="text-sm text-mute">Shown once. Share it securely; the user should change it after first login.</p>
        <p className="mt-3 select-all rounded-xl bg-bg p-3 font-mono text-sm">{tempPw}</p>
      </Modal>
      <Modal open={!!view} title={`Activity: ${view?.e.full_name ?? view?.e.email}`} onClose={() => setView(null)}>
        <div className="max-h-80 space-y-4 overflow-y-auto text-sm">
          <div><p className="label">Recent inspections</p>{view?.a.inspections.length ? view.a.inspections.map(i => <p key={i.id} className="flex justify-between py-1"><span><Badge value={i.status} /> {i.batch_number ?? ""}</span><span className="text-mute">{i.created_at.slice(0, 10)}</span></p>) : <p className="text-mute">None</p>}</div>
          <div><p className="label">Audit log</p>{view?.a.audit.length ? view.a.audit.map((a, i) => <p key={i} className="flex justify-between py-1"><span>{a.action}</span><span className="text-mute">{a.created_at.slice(0, 16).replace("T", " ")}</span></p>) : <p className="text-mute">None</p>}</div>
        </div>
      </Modal>
    </>
  );
}
