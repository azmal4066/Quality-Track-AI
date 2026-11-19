import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ScanSearch, Package, Bug } from "lucide-react";
import { supabase } from "../services/supabase";
import { Badge, Empty, PageHeader, Skeleton, Stat } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { groupPassRate } from "../utils/stats";

const COLORS = ["#3B82F6", "#06B6D4", "#F59E0B", "#EF4444", "#22C55E", "#A78BFA"];
const tip = { contentStyle: { background: "rgb(var(--card))", border: "1px solid rgb(var(--line))", borderRadius: 12, fontSize: 12 } };

export default function Dashboard() {
  const { can } = useAuth();
  const [ins, setIns] = useState<any[] | null>(null);
  const [defs, setDefs] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const a = await supabase.from("inspections").select("id,status,quality_score,batch_number,created_at,products(product_code,name,category)").order("created_at", { ascending: false }).limit(1000);
      const b = await supabase.from("defects").select("id,defect_type,severity,created_at,confidence").order("created_at", { ascending: false }).limit(1000);
      if (a.error || b.error) { setErr((a.error ?? b.error)!.message); return; }
      setIns(a.data as any[]); setDefs(b.data as any[]);
      const r = await supabase.from("reports").select("id,report_type,created_at").order("created_at", { ascending: false }).limit(5); setReports(r.data ?? []);
    })();
  }, []);

  if (err) return <p className="card p-6 text-sm text-bad">Could not load dashboard: {err}</p>;
  if (!ins) return <><PageHeader title="Dashboard" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div></>;

  const total = ins.length, pass = ins.filter(i => i.status === "PASS").length, fail = ins.filter(i => i.status === "FAIL").length, rev = ins.filter(i => i.status === "REVIEW").length;
  const scores = ins.map(i => Number(i.quality_score)).filter(n => !Number.isNaN(n));
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "-";
  const daily: Record<string, any> = {};
  ins.forEach(i => { const d = i.created_at.slice(0, 10); (daily[d] ??= { date: d, PASS: 0, FAIL: 0, REVIEW: 0 })[i.status]++; });
  const activity = Object.values(daily).sort((a: any, b: any) => a.date.localeCompare(b.date)).slice(-14);
  const byType: Record<string, number> = {}; defs.forEach(d => (byType[d.defect_type] = (byType[d.defect_type] ?? 0) + 1));
  const cats = groupPassRate(ins, i => i.products?.category ?? "Unlinked").slice(0, 5);
  const timeline = ins.slice(0, 8);
  const pie = Object.entries(byType).map(([name, value]) => ({ name, value }));

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Live figures from your inspection records."
        actions={can("super_admin", "admin", "inspector") ? <Link to="/inspect" className="btn-primary"><ScanSearch className="h-4 w-4" />New inspection</Link> : null} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Total inspections" value={total} />
        <Stat label="Passed" value={pass} tone="ok" />
        <Stat label="Failed" value={fail} tone="bad" />
        <Stat label="Pending review" value={rev} tone="warn" />
        <Stat label="Defect rate" value={total ? `${((fail / total) * 100).toFixed(1)}%` : "-"} hint="Failed / total" tone="bad" />
        <Stat label="Average quality score" value={avg} hint="Derived 0-100 score, not model confidence" />
      </div>

      {total === 0 ? (
        <div className="card mt-6"><Empty title="No inspections yet" text="Run your first AI inspection and the charts will fill in from real records."
          action={can("super_admin", "admin", "inspector") ? <Link to="/inspect" className="btn-primary">Start inspection</Link> : undefined} /></div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            <div className="card p-5 xl:col-span-2">
              <h2 className="mb-4 font-bold">Daily inspection activity</h2>
              <div className="h-72"><ResponsiveContainer>
                <AreaChart data={activity}>
                  <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
                  <XAxis dataKey="date" stroke="rgb(var(--mute))" fontSize={11} tickLine={false} />
                  <YAxis stroke="rgb(var(--mute))" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip {...tip} />
                  <Area dataKey="PASS" stackId="1" stroke="#22C55E" fill="#22C55E33" />
                  <Area dataKey="REVIEW" stackId="1" stroke="#F59E0B" fill="#F59E0B33" />
                  <Area dataKey="FAIL" stackId="1" stroke="#EF4444" fill="#EF444433" />
                </AreaChart></ResponsiveContainer></div>
            </div>
            <div className="card p-5">
              <h2 className="mb-4 font-bold">Defect categories</h2>
              {pie.length === 0 ? <p className="py-16 text-center text-sm text-mute">No defects recorded.</p> :
                <div className="h-72"><ResponsiveContainer><PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3} stroke="none">{pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie>
                  <Tooltip {...tip} />
                </PieChart></ResponsiveContainer></div>}
              <ul className="mt-2 space-y-1 text-xs">{pie.map((p, i) => <li key={p.name} className="flex justify-between"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{p.name}</span><span className="font-mono">{p.value}</span></li>)}</ul>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="card p-5">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Recent inspections</h2><Link to="/history" className="text-xs text-brand hover:underline">View all</Link></div>
              <ul className="divide-y divide-line">{ins.slice(0, 6).map(i => (
                <li key={i.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div><p className="font-semibold">{i.products?.name ?? "Unlinked product"}</p><p className="text-xs text-mute">{i.batch_number ?? "No batch"} - {new Date(i.created_at).toLocaleString()}</p></div>
                  <Badge value={i.status} />
                </li>))}</ul>
            </div>
            <div className="card p-5">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Recent detected defects</h2><Link to="/defects" className="text-xs text-brand hover:underline">Manage</Link></div>
              {defs.length === 0 ? <p className="py-8 text-center text-sm text-mute">No defects recorded.</p> :
                <ul className="divide-y divide-line">{defs.slice(0, 6).map(d => (
                  <li key={d.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="flex items-center gap-3"><Bug className="h-4 w-4 text-mute" /><div><p className="font-semibold">{d.defect_type}</p><p className="font-mono text-xs text-mute">confidence {(Number(d.confidence) * 100).toFixed(0)}%</p></div></div>
                    <Badge value={d.severity} />
                  </li>))}</ul>}
            </div>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <div className="card p-5"><h2 className="mb-3 font-bold">Top product categories</h2>
              <ul className="space-y-2 text-sm">{cats.map(c => <li key={c.name} className="flex justify-between"><span>{c.name}</span><span className="font-mono text-mute">{c.pass_rate}% pass · {c.total}</span></li>)}</ul></div>
            <div className="card p-5"><h2 className="mb-3 font-bold">Activity timeline</h2>
              <ol className="space-y-2 border-l border-line pl-4 text-sm">{timeline.map(i => <li key={i.id}><Badge value={i.status} /> <span className="text-mute">{new Date(i.created_at).toLocaleString()}</span></li>)}</ol></div>
            <div className="card p-5"><h2 className="mb-3 font-bold">Latest reports</h2>
              {reports.length === 0 ? <p className="text-sm text-mute">No reports generated yet.</p> : <ul className="space-y-2 text-sm">{reports.map(r => <li key={r.id} className="flex justify-between"><span>{r.report_type}</span><span className="text-mute">{new Date(r.created_at).toLocaleDateString()}</span></li>)}</ul>}
              <Link to="/reports" className="mt-3 inline-block text-xs text-brand hover:underline">Open reports</Link></div>
          </div>
        </>
      )}
      <div className="mt-6 flex flex-wrap gap-2 text-sm"><Link to="/products" className="btn-ghost"><Package className="h-4 w-4" />Products</Link><Link to="/analytics" className="btn-ghost">Analytics</Link><Link to="/batch" className="btn-ghost">Batch inspection</Link><Link to="/reports" className="btn-ghost">Reports</Link></div>
    </>
  );
}
