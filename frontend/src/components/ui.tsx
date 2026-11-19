import clsx from "clsx";
import { Inbox, X } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-mute">{subtitle}</p>}
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
  );
}

const tones: Record<string, string> = {
  PASS: "bg-ok/15 text-ok", FAIL: "bg-bad/15 text-bad", REVIEW: "bg-warn/15 text-warn",
  low: "bg-cyan/15 text-cyan", medium: "bg-warn/15 text-warn", high: "bg-orange-500/15 text-orange-400", critical: "bg-bad/15 text-bad",
  open: "bg-bad/15 text-bad", under_review: "bg-warn/15 text-warn", resolved: "bg-ok/15 text-ok", closed: "bg-line text-mute",
};
export function Badge({ value }: { value: string }) {
  return <span className={clsx("inline-flex rounded-lg px-2.5 py-1 text-xs font-bold", tones[value] ?? "bg-line text-mute")}>{value.replace("_", " ")}</span>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "ok" | "bad" | "warn" | "brand" }) {
  const bar = { ok: "bg-ok", bad: "bg-bad", warn: "bg-warn", brand: "bg-brand" }[tone ?? "brand"];
  return (
    <div className="card relative overflow-hidden p-5">
      <span className={clsx("absolute inset-y-0 left-0 w-1", bar)} />
      <p className="text-xs font-semibold text-mute">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-mute">{hint}</p>}
    </div>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={clsx("skeleton", className)} />;

export function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 rounded-2xl bg-line/50 p-4"><Inbox className="h-6 w-6 text-mute" /></div>
      <p className="font-bold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-mute">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="card w-full max-w-lg p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-mute" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ open, title, text, confirmLabel, onConfirm, onClose }: { open: boolean; title: string; text: string; confirmLabel: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-sm text-mute">{text}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-danger" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
