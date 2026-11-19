import { useEffect, useState } from "react";
import { Legend, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart } from "recharts";
import { api } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import type { Row } from "../utils/stats";
import { Empty, PageHeader, Skeleton, Stat } from "../components/ui";

const tip = { contentStyle: { background: "rgb(var(--card))", border: "1px solid rgb(var(--line))", borderRadius: 12, fontSize: 12 } };

export default function Analytics() {
  const { notify } = useToast();
  const [o, setO] = useState<any | null>(null); const [t, setT] = useState<any[]>([]);
  const [b, setB] = useState<Record<string, Row[]>>({});
  useEffect(() => {
    Promise.all([api.get("/api/analytics/overview"), api.get<any[]>("/api/analytics/trends"), api.get<Record<string, Row[]>>("/api/analytics/breakdown")])
      .then(([a, tr, br]) => { setO(a); setT(tr); setB(br); }).catch(e => { notify("error", e.message); setO({ total_inspections: 0 }); });
  }, []); // eslint-disable-line
  if (!o) return <><PageHeader title="Quality Analytics" /><Skeleton className="h-64" /></>;
  if (!o.total_inspections) return <><PageHeader title="Quality Analytics" /><div className="card"><Empty title="No data yet" text="Analytics are calculated from saved inspections. Run an inspection first." /></div></>;
  const total = o.total_inspections;
  const freq = Object.entries(o.defects_by_type).map(([name, value]) => ({ name, value }));
  const sev = Object.entries(o.defects_by_severity).map(([name, value]) => ({ name, value }));
  return (
    <>
      <PageHeader title="Quality Analytics" subtitle="All figures are calculated from stored inspection records." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Pass rate" value={`${((o.passed / total) * 100).toFixed(1)}%`} tone="ok" />
        <Stat label="Fail rate" value={`${((o.failed / total) * 100).toFixed(1)}%`} tone="bad" />
        <Stat label="Average quality score" value={o.avg_quality_score ?? "-"} hint="Derived score, separate from model confidence" />
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="card p-5"><h2 className="mb-4 font-bold">Pass / fail trend</h2><div className="h-72"><ResponsiveContainer><LineChart data={t}><CartesianGrid stroke="rgb(var(--line))" vertical={false} /><XAxis dataKey="date" stroke="rgb(var(--mute))" fontSize={11} /><YAxis stroke="rgb(var(--mute))" fontSize={11} allowDecimals={false} /><Tooltip {...tip} /><Line dataKey="PASS" stroke="#22C55E" dot={false} strokeWidth={2} /><Line dataKey="FAIL" stroke="#EF4444" dot={false} strokeWidth={2} /><Line dataKey="REVIEW" stroke="#F59E0B" dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer></div></div>
        <div className="card p-5"><h2 className="mb-4 font-bold">Defect frequency</h2><div className="h-72"><ResponsiveContainer><BarChart data={freq}><CartesianGrid stroke="rgb(var(--line))" vertical={false} /><XAxis dataKey="name" stroke="rgb(var(--mute))" fontSize={11} /><YAxis stroke="rgb(var(--mute))" fontSize={11} allowDecimals={false} /><Tooltip {...tip} /><Bar dataKey="value" fill="#3B82F6" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
        <div className="card p-5"><h2 className="mb-4 font-bold">Severity distribution</h2><div className="h-72"><ResponsiveContainer><BarChart data={sev}><CartesianGrid stroke="rgb(var(--line))" vertical={false} /><XAxis dataKey="name" stroke="rgb(var(--mute))" fontSize={11} /><YAxis stroke="rgb(var(--mute))" fontSize={11} allowDecimals={false} /><Tooltip {...tip} /><Bar dataKey="value" fill="#06B6D4" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {([["month", "Monthly quality trend"], ["category", "Product category performance"], ["batch", "Batch-wise comparison"], ["inspector", "Inspector activity"]] as const).map(([k, title]) => (
          <div key={k} className="card p-5"><h2 className="mb-4 font-bold">{title}</h2>
            {(b[k] ?? []).length === 0 ? <p className="py-12 text-center text-sm text-mute">No data.</p> :
              <div className="h-72"><ResponsiveContainer><BarChart data={b[k]}><CartesianGrid stroke="rgb(var(--line))" vertical={false} /><XAxis dataKey="name" stroke="rgb(var(--mute))" fontSize={11} /><YAxis stroke="rgb(var(--mute))" fontSize={11} allowDecimals={false} /><Tooltip {...tip} /><Legend />
                <Bar dataKey="pass" name="Pass" stackId="a" fill="#22C55E" /><Bar dataKey="fail" name="Fail" stackId="a" fill="#EF4444" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>}
          </div>))}
      </div>
    </>
  );
}
