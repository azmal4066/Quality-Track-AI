import { useEffect, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { api } from "../services/api";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import { PageHeader } from "../components/ui";
import type { ModelStatus } from "../types";

type S = { thresholds?: { pass_max_confidence: number; fail_min_confidence: number }; defect_categories?: string[]; product_categories?: string[]; company?: { name?: string; address?: string }; notifications?: { on_fail?: boolean; on_review?: boolean } };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return <section className="card p-5"><h2 className="font-bold">{title}</h2>{hint && <p className="mb-3 text-xs text-mute">{hint}</p>}<div className="mt-3 space-y-3">{children}</div></section>;
}

function ListEditor({ items, onSave, disabled }: { items: string[]; onSave: (v: string[]) => void; disabled: boolean }) {
  const [v, setV] = useState(""); 
  return <>
    <div className="flex flex-wrap gap-2">{items.map(i => <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-line/50 px-2.5 py-1 text-xs font-semibold">{i}{!disabled && <button aria-label={`Remove ${i}`} onClick={() => onSave(items.filter(x => x !== i))}><X className="h-3 w-3" /></button>}</span>)}</div>
    {!disabled && <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (v.trim()) { onSave([...items, v.trim()]); setV(""); } }}>
      <input className="input" value={v} onChange={e => setV(e.target.value)} placeholder="Add new" aria-label="New item" /><button className="btn-ghost"><Plus className="h-4 w-4" /></button></form>}
  </>;
}

export default function Settings() {
  const { profile, can, session } = useAuth(); const { theme, toggle } = useTheme(); const { notify } = useToast();
  const admin = can("super_admin", "admin");
  const [s, setS] = useState<S>({});
  const [model, setModel] = useState<ModelStatus | null>(null);
  const load = () => api.get<S>("/api/settings").then(setS).catch(e => notify("error", e.message));
  useEffect(() => { load(); api.get<ModelStatus>("/api/model/status").then(setModel).catch(() => {}); }, []); // eslint-disable-line

  const save = async (key: string, value: unknown, ok = "Saved") => {
    try { await api.put(`/api/settings/${key}`, { value }); notify("success", ok); load(); }
    catch (e) { notify("error", e instanceof Error ? e.message : "Save failed"); }
  };
  const saveProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("full_name") ?? "").trim();
    const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", session!.user.id);
    error ? notify("error", error.message) : notify("success", "Profile updated (reload to see it everywhere)");
  };
  const changePw = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget; const pw = String(new FormData(f).get("pw")); const pw2 = String(new FormData(f).get("pw2"));
    if (pw.length < 8) return notify("error", "Password must be at least 8 characters");
    if (pw !== pw2) return notify("error", "Passwords do not match");
    const { error } = await supabase.auth.updateUser({ password: pw });
    error ? notify("error", error.message) : (notify("success", "Password changed"), f.reset());
  };
  const th = s.thresholds ?? { pass_max_confidence: 0.3, fail_min_confidence: 0.6 };

  return (
    <>
      <PageHeader title="Settings" subtitle={admin ? "Profile, company and inspection configuration." : "Your profile and preferences. Company settings are admin-only."} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Profile">
          <form onSubmit={saveProfile} className="space-y-3" key={profile?.id}>
            <div><label className="label" htmlFor="fn">Full name</label><input id="fn" name="full_name" className="input" defaultValue={profile?.full_name ?? ""} required /></div>
            <div><label className="label">Email</label><input className="input opacity-70" value={profile?.email ?? ""} readOnly /></div>
            <p className="text-xs text-mute">Role: <b>{profile?.role}</b> (changed only by an admin)</p>
            <button className="btn-primary">Save profile</button>
          </form>
        </Section>
        <Section title="Theme"><button className="btn-ghost" onClick={toggle}>Switch to {theme === "dark" ? "light" : "dark"} theme</button></Section>
        <Section title="Security" hint="Change your password.">
          <form onSubmit={changePw} className="space-y-3">
            <input className="input" type="password" name="pw" placeholder="New password" minLength={8} required aria-label="New password" autoComplete="new-password" />
            <input className="input" type="password" name="pw2" placeholder="Confirm password" minLength={8} required aria-label="Confirm password" autoComplete="new-password" />
            <button className="btn-primary">Change password</button>
          </form>
        </Section>
        <Section title="AI model status">
          {!model ? <p className="text-sm text-mute">Status unavailable.</p> : <>
            <p className="text-sm"><b className={model.available ? "text-ok" : "text-bad"}>{model.available ? "Model loaded" : "Model unavailable"}</b> · version {model.model_version}</p>
            {model.available ? <p className="text-xs text-mute">Classes: {model.classes.join(", ") || "-"}</p> : <p className="text-xs text-mute">{model.error} {model.setup_hint}</p>}</>}
        </Section>
        <Section title="Inspection thresholds" hint="PASS if top confidence ≤ pass limit; FAIL if ≥ fail limit; otherwise REVIEW.">
          <form className="grid grid-cols-2 gap-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); save("thresholds", { pass_max_confidence: Number(f.get("lo")), fail_min_confidence: Number(f.get("hi")) }); }} key={JSON.stringify(th)}>
            <div><label className="label" htmlFor="lo">Pass limit</label><input id="lo" name="lo" type="number" step="0.01" min="0" max="1" className="input" defaultValue={th.pass_max_confidence} disabled={!admin} /></div>
            <div><label className="label" htmlFor="hi">Fail limit</label><input id="hi" name="hi" type="number" step="0.01" min="0" max="1" className="input" defaultValue={th.fail_min_confidence} disabled={!admin} /></div>
            {admin && <button className="btn-primary col-span-2">Save thresholds</button>}
          </form>
        </Section>
        <Section title="Company information">
          <form className="space-y-3" key={JSON.stringify(s.company)} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); save("company", { name: f.get("name"), address: f.get("address") }); }}>
            <input name="name" className="input" placeholder="Company name" defaultValue={s.company?.name ?? ""} disabled={!admin} aria-label="Company name" />
            <input name="address" className="input" placeholder="Address" defaultValue={s.company?.address ?? ""} disabled={!admin} aria-label="Address" />
            {admin && <button className="btn-primary">Save company</button>}
          </form>
        </Section>
        <Section title="Product categories"><ListEditor items={s.product_categories ?? []} disabled={!admin} onSave={v => save("product_categories", v)} /></Section>
        <Section title="Defect categories" hint="Labels you track. The AI model can only detect the classes it was trained on (see model status).">
          <ListEditor items={s.defect_categories ?? []} disabled={!admin} onSave={v => save("defect_categories", v)} /></Section>
        <Section title="Notification preferences" hint="Stored preference only. Email/push delivery is not implemented yet.">
          {(["on_fail", "on_review"] as const).map(k => (
            <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!admin} checked={!!s.notifications?.[k]} onChange={e => save("notifications", { ...s.notifications, [k]: e.target.checked })} />{k === "on_fail" ? "Notify on FAIL results" : "Notify on REVIEW results"}</label>))}
        </Section>
      </div>
    </>
  );
}
