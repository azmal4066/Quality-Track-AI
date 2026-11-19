export type Row = { name: string; total: number; pass: number; fail: number; pass_rate: number };

export const pct = (part: number, total: number, digits = 1) => (total ? `${((part / total) * 100).toFixed(digits)}%` : "-");

export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return rows.map(r => r.map(esc).join(",")).join("\n");
}

export function groupPassRate<T extends { status: string }>(items: T[], key: (i: T) => string): Row[] {
  const m = new Map<string, T[]>();
  items.forEach(i => { const k = key(i); m.set(k, [...(m.get(k) ?? []), i]); });
  return [...m.entries()].map(([name, v]) => {
    const pass = v.filter(x => x.status === "PASS").length;
    return { name, total: v.length, pass, fail: v.filter(x => x.status === "FAIL").length, pass_rate: Math.round((pass / v.length) * 1000) / 10 };
  }).sort((a, b) => b.total - a.total);
}
