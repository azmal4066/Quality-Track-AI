import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { supabase, isConfigured } from "../services/supabase";
import { useAuth } from "../contexts/AuthContext";

function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-line bg-side lg:block">
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(rgb(var(--line)) 1px,transparent 1px),linear-gradient(90deg,rgb(var(--line)) 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand shadow-glow"><ShieldCheck className="h-5 w-5 text-white" /></div><span className="text-xl font-extrabold">QualityTrack<span className="text-cyan"> AI</span></span></div>
          <div>
            <div className="relative mb-8 h-56 w-80 rounded-2xl border border-line bg-bg/60">
              <div className="absolute left-10 top-10 h-24 w-32 rounded-md border-2 border-bad"><span className="absolute -top-6 left-0 rounded bg-bad px-2 py-0.5 font-mono text-[11px] font-semibold text-white">crack 0.91</span></div>
              <div className="absolute bottom-8 right-10 h-14 w-20 rounded-md border-2 border-warn"><span className="absolute -top-6 left-0 rounded bg-warn px-2 py-0.5 font-mono text-[11px] font-semibold text-black">scratch 0.54</span></div>
            </div>
            <h2 className="max-w-md text-3xl font-extrabold leading-tight tracking-tight">Every product inspected. Every defect traced.</h2>
            <p className="mt-3 max-w-md text-mute">Illustration only. Real detections come from your trained YOLO model.</p>
          </div>
          <p className="text-xs text-mute">Industrial quality inspection platform</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-mute">{sub}</p>
          {!isConfigured && <p className="mb-4 rounded-xl bg-warn/15 p-3 text-sm text-warn">Supabase is not configured. Copy .env.example to frontend/.env and add your project URL and anon key.</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

function useAuthForm(action: (email: string, pw: string, name: string) => Promise<string | null>) {
  const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setErr(null); setMsg(null); setBusy(true);
    const f = new FormData(e.currentTarget);
    const r = await action(String(f.get("email")), String(f.get("password") ?? ""), String(f.get("name") ?? ""));
    setBusy(false); if (r) { if (r.startsWith("!")) setMsg(r.slice(1)); else setErr(r); }
  };
  return { err, msg, busy, submit };
}
const Feedback = ({ err, msg }: { err: string | null; msg: string | null }) => (<>
  {err && <p className="rounded-xl bg-bad/15 p-3 text-sm text-bad" role="alert">{err}</p>}
  {msg && <p className="rounded-xl bg-ok/15 p-3 text-sm text-ok" role="status">{msg}</p>}
</>);

export function Login() {
  const { session } = useAuth(); const nav = useNavigate();
  const f = useAuthForm(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message; nav("/"); return null;
  });
  if (session) return <Navigate to="/" replace />;
  return (
    <Shell title="Sign in" sub="Use your QualityTrack account.">
      <form onSubmit={f.submit} className="space-y-4">
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" autoComplete="email" /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required className="input" autoComplete="current-password" /></div>
        <Feedback err={f.err} msg={f.msg} />
        <button className="btn-primary w-full" disabled={f.busy}>{f.busy ? "Signing in..." : "Sign in"}</button>
      </form>
      <div className="mt-5 flex justify-between text-sm"><Link to="/forgot" className="text-brand hover:underline">Forgot password?</Link><Link to="/register" className="text-brand hover:underline">Create account</Link></div>
    </Shell>
  );
}

export function Register() {
  const f = useAuthForm(async (email, password, name) => {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: window.location.origin } });
    return error ? error.message : "!Check your email to confirm the account. An admin must assign your role before you can inspect products.";
  });
  return (
    <Shell title="Create account" sub="New accounts start as Viewer. An admin assigns your role.">
      <form onSubmit={f.submit} className="space-y-4">
        <div><label className="label" htmlFor="name">Full name</label><input id="name" name="name" required className="input" /></div>
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" minLength={8} required className="input" autoComplete="new-password" /></div>
        <Feedback err={f.err} msg={f.msg} />
        <button className="btn-primary w-full" disabled={f.busy}>{f.busy ? "Creating..." : "Create account"}</button>
      </form>
      <p className="mt-5 text-sm text-mute">Already registered? <Link to="/login" className="text-brand hover:underline">Sign in</Link></p>
    </Shell>
  );
}

export function Forgot() {
  const f = useAuthForm(async email => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset` });
    return error ? error.message : "!If that email exists, a reset link has been sent.";
  });
  return (
    <Shell title="Reset password" sub="We will email you a reset link.">
      <form onSubmit={f.submit} className="space-y-4">
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" /></div>
        <Feedback err={f.err} msg={f.msg} />
        <button className="btn-primary w-full" disabled={f.busy}>Send reset link</button>
      </form>
      <p className="mt-5 text-sm"><Link to="/login" className="text-brand hover:underline">Back to sign in</Link></p>
    </Shell>
  );
}

export function ResetPassword() {
  const nav = useNavigate();
  const f = useAuthForm(async (_e, password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return error.message; nav("/"); return null;
  });
  return (
    <Shell title="Choose a new password" sub="Open this page from the link in your reset email.">
      <form onSubmit={f.submit} className="space-y-4">
        <input name="email" type="hidden" value="x" />
        <div><label className="label" htmlFor="password">New password</label><input id="password" name="password" type="password" minLength={8} required className="input" autoComplete="new-password" /></div>
        <Feedback err={f.err} msg={f.msg} />
        <button className="btn-primary w-full" disabled={f.busy}>Update password</button>
      </form>
    </Shell>
  );
}
