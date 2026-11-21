import { useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  AlertCircle, ArrowRight, BarChart3, Bug, CheckCircle2, Eye, EyeOff, Info, KeyRound, Loader2, Lock,
  LogIn, Mail, Moon, ScanSearch, ShieldCheck, Sun, User, UserPlus,
  type LucideIcon,
} from "lucide-react";
import { supabase, isConfigured } from "../services/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";

/* ---------- Brand ---------- */
function Logo({ className }: { className?: string }) {
  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand shadow-glow"><ShieldCheck className="h-5 w-5 text-white" /></div>
      <span className="text-xl font-extrabold tracking-tight">QualityTrack<span className="text-cyan"> AI</span></span>
    </div>
  );
}

/* ---------- Left showcase panel (desktop) ---------- */
const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ScanSearch, title: "AI inspection", text: "Upload an image and get defects with confidence scores." },
  { icon: Bug, title: "Defect tracking", text: "Raise, review and resolve defects in one place." },
  { icon: BarChart3, title: "Quality analytics", text: "Trends, reports and an assistant that knows your data." },
];

function InspectionPreview() {
  return (
    <div className="relative w-full max-w-md" aria-hidden="true">
      <div className="absolute -inset-6 rounded-[2rem] bg-brand/10 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-line bg-card/80 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <div className="flex items-center gap-2 font-mono text-[11px] font-semibold text-mute">
            <span className="h-2 w-2 rounded-full bg-ok" style={{ animation: "qt-blink 1.6s ease-in-out infinite" }} />LIVE · YOLO
          </div>
          <span className="font-mono text-[11px] text-mute">unit #0482</span>
        </div>

        <div className="relative h-56 bg-bg/70">
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(rgb(var(--line)) 1px,transparent 1px),linear-gradient(90deg,rgb(var(--line)) 1px,transparent 1px)", backgroundSize: "24px 24px" }} />
          <div className="absolute inset-6 rounded-xl border border-line bg-gradient-to-br from-line/70 via-line/30 to-line/70" />
          <svg className="absolute inset-6 h-[calc(100%-3rem)] w-[calc(100%-3rem)]" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline points="18,22 26,34 22,46 33,58 29,66" fill="none" stroke="rgb(var(--mute))" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
            <line x1="62" y1="70" x2="86" y2="80" stroke="rgb(var(--mute))" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>

          <div className="absolute left-[16%] top-[22%] h-[46%] w-[26%] rounded-md border-2 border-bad" style={{ animation: "qt-pop 5s ease-in-out infinite" }}>
            <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-bad px-2 py-0.5 font-mono text-[11px] font-semibold text-white">crack 0.91</span>
          </div>
          <div className="absolute bottom-[14%] right-[10%] h-[18%] w-[28%] rounded-md border-2 border-warn" style={{ animation: "qt-pop 5s ease-in-out 1.2s infinite" }}>
            <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-warn px-2 py-0.5 font-mono text-[11px] font-semibold text-black">scratch 0.54</span>
          </div>

          <div className="absolute inset-x-0 top-0 h-full" style={{ animation: "qt-scan 4.5s ease-in-out infinite" }}>
            <div className="absolute inset-x-0 -top-10 h-10 bg-gradient-to-b from-transparent to-cyan/20" />
            <div className="h-0.5 bg-cyan" style={{ boxShadow: "0 0 14px 2px rgb(6 182 212 / .7)" }} />
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-bad/15 px-2.5 py-1 text-xs font-bold text-bad">FAIL</span>
            <span className="text-xs text-mute">2 defects found</span>
          </div>
          <span className="font-mono text-xs text-mute">38 ms</span>
        </div>
      </div>
    </div>
  );
}

function ShowcasePanel() {
  return (
    <div className="relative hidden overflow-hidden border-r border-line bg-side lg:block">
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(rgb(var(--line)) 1px,transparent 1px),linear-gradient(90deg,rgb(var(--line)) 1px,transparent 1px)", backgroundSize: "48px 48px", maskImage: "radial-gradient(ellipse at 30% 40%, #000 20%, transparent 75%)", WebkitMaskImage: "radial-gradient(ellipse at 30% 40%, #000 20%, transparent 75%)" }} />
      <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand/20 blur-3xl" />
      <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-cyan/10 blur-3xl" />

      <div className="relative flex h-full min-h-[640px] flex-col justify-between gap-10 p-12 xl:p-14">
        <Logo />

        <div className="space-y-10">
          <InspectionPreview />
          <div>
            <h2 className="max-w-md text-4xl font-extrabold leading-[1.1] tracking-tight">
              Every product inspected.{" "}
              <span className="bg-gradient-to-r from-brand to-cyan bg-clip-text text-transparent">Every defect traced.</span>
            </h2>
            <ul className="mt-8 max-w-md space-y-4">
              {FEATURES.map(f => (
                <li key={f.title} className="flex items-start gap-3.5">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-card/70 text-brand"><f.icon className="h-[18px] w-[18px]" /></div>
                  <div>
                    <p className="text-sm font-bold">{f.title}</p>
                    <p className="text-sm text-mute">{f.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-xs text-mute">Industrial quality inspection platform · Preview above is an illustration. Real detections come from your trained YOLO model.</p>
      </div>
    </div>
  );
}

/* ---------- Page shell ---------- */
function Shell({ title, sub, icon: Icon, children }: { title: string; sub: string; icon: LucideIcon; children: ReactNode }) {
  const { theme, toggle } = useTheme();
  return (
    <div className="grid min-h-full bg-bg lg:grid-cols-[1.1fr_1fr]">
      <style>{`
        @keyframes qt-scan { 0% { transform: translateY(-2%); } 50% { transform: translateY(98%); } 100% { transform: translateY(-2%); } }
        @keyframes qt-pop { 0%, 12% { opacity: 0; transform: scale(.92); } 22%, 80% { opacity: 1; transform: scale(1); } 92%, 100% { opacity: 0; transform: scale(.98); } }
        @keyframes qt-blink { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
        @keyframes qt-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <ShowcasePanel />

      <div className="relative flex min-h-full flex-col px-5 py-5 sm:px-8">
        <div className="flex items-center justify-between">
          <Logo className="lg:invisible [&>div]:h-9 [&>div]:w-9 [&>span]:text-lg" />
          <button type="button" onClick={toggle} className="btn-ghost !p-2.5" aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[420px]" style={{ animation: "qt-in .45s ease-out both" }}>
            <div className="card p-6 shadow-2xl sm:p-8">
              <div className="mb-6">
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand/15 text-brand"><Icon className="h-5 w-5" /></div>
                <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
                <p className="mt-1.5 text-sm text-mute">{sub}</p>
              </div>
              {!isConfigured && (
                <div className="mb-5 flex gap-2.5 rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-warn" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>Supabase is not configured. Copy .env.example to frontend/.env and add your project URL and anon key.</p>
                </div>
              )}
              {children}
            </div>
            <p className="mt-6 text-center text-xs text-mute">Protected by Supabase Auth · QualityTrack AI</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Form pieces ---------- */
type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "name"> & {
  id: string; name: string; label: string; icon: LucideIcon; aside?: ReactNode;
};

function Field({ id, label, icon: Icon, aside, type = "text", onKeyUp, ...rest }: FieldProps) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const isPw = type === "password";
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="label !mb-0" htmlFor={id}>{label}</label>
        {aside}
      </div>
      <div className="group relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mute transition-colors group-focus-within:text-brand" />
        <input
          id={id}
          type={isPw && show ? "text" : type}
          className={clsx("input !pl-10 !py-3 transition-shadow focus:ring-4 focus:ring-brand/15", isPw && "!pr-11")}
          onKeyUp={e => { if (isPw) setCaps(e.getModifierState("CapsLock")); onKeyUp?.(e); }}
          {...rest}
        />
        {isPw && (
          <button
            type="button" onClick={() => setShow(s => !s)} tabIndex={-1}
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-mute transition-colors hover:bg-line/40 hover:text-ink"
            aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {isPw && caps && <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-warn"><AlertCircle className="h-3.5 w-3.5" />Caps Lock is on</p>}
    </div>
  );
}

const SEGMENT_ON = ["bg-bad", "bg-warn", "bg-cyan", "bg-ok"];
const STRENGTH_LABEL = ["", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_TEXT = ["", "text-bad", "text-warn", "text-cyan", "text-ok"];

function scorePassword(pw: string) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.max(1, s);
}

function StrengthMeter({ value }: { value: string }) {
  const score = scorePassword(value);
  return (
    <div className="mt-2.5" aria-live="polite">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map(i => <span key={i} className={clsx("h-1.5 flex-1 rounded-full transition-colors", i <= score ? SEGMENT_ON[score - 1] : "bg-line")} />)}
      </div>
      <p className="mt-1.5 text-xs text-mute">
        {score ? <>Strength: <span className={clsx("font-bold", STRENGTH_TEXT[score])}>{STRENGTH_LABEL[score]}</span></> : "Use 8+ characters with letters, numbers and symbols."}
      </p>
    </div>
  );
}

function Submit({ busy, idle, loading }: { busy: boolean; idle: string; loading: string }) {
  return (
    <button className="btn-primary w-full !py-3 shadow-glow" disabled={busy}>
      {busy ? <><Loader2 className="h-4 w-4 animate-spin" />{loading}</> : <>{idle}<ArrowRight className="h-4 w-4" /></>}
    </button>
  );
}

function Switch({ text, to, label }: { text: string; to: string; label: string }) {
  return (
    <div className="mt-6 border-t border-line pt-5 text-center text-sm text-mute">
      {text} <Link to={to} className="font-semibold text-brand hover:underline">{label}</Link>
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
  {err && <div className="flex gap-2.5 rounded-xl border border-bad/30 bg-bad/10 p-3 text-sm text-bad" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>{err}</p></div>}
  {msg && <div className="flex gap-2.5 rounded-xl border border-ok/30 bg-ok/10 p-3 text-sm text-ok" role="status"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><p>{msg}</p></div>}
</>);

/* ---------- Pages ---------- */
export function Login() {
  const { session } = useAuth(); const nav = useNavigate();
  const f = useAuthForm(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message; nav("/"); return null;
  });
  if (session) return <Navigate to="/" replace />;
  return (
    <Shell icon={LogIn} title="Welcome back" sub="Sign in to your QualityTrack account.">
      <form onSubmit={f.submit} className="space-y-4">
        <Field id="email" name="email" type="email" label="Email" icon={Mail} required autoComplete="email" placeholder="you@company.com" />
        <Field id="password" name="password" type="password" label="Password" icon={Lock} required autoComplete="current-password" placeholder="Enter your password"
          aside={<Link to="/forgot" className="text-xs font-semibold text-brand hover:underline">Forgot password?</Link>} />
        <Feedback err={f.err} msg={f.msg} />
        <Submit busy={f.busy} idle="Sign in" loading="Signing in..." />
      </form>
      <Switch text="New to QualityTrack?" to="/register" label="Create an account" />
    </Shell>
  );
}

export function Register() {
  const { session } = useAuth(); const nav = useNavigate();
  const [pw, setPw] = useState("");
  const f = useAuthForm(async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (error) return error.message;
    // Email confirmation is OFF in Supabase -> a session is returned immediately.
    if (data.session) { nav("/"); return null; }
    // Fallback: account created but confirmation is still ON in the Supabase dashboard.
    if (data.user && data.user.identities?.length === 0) return "This email is already registered. Please sign in.";
    return "!Account created. Please sign in.";
  });
  if (session) return <Navigate to="/" replace />;
  return (
    <Shell icon={UserPlus} title="Create account" sub="Join your team on QualityTrack AI.">
      <form onSubmit={f.submit} className="space-y-4">
        <Field id="name" name="name" label="Full name" icon={User} required autoComplete="name" placeholder="Your full name" />
        <Field id="email" name="email" type="email" label="Email" icon={Mail} required autoComplete="email" placeholder="you@company.com" />
        <div>
          <Field id="password" name="password" type="password" label="Password" icon={Lock} minLength={8} required autoComplete="new-password" placeholder="At least 8 characters"
            onChange={e => setPw(e.target.value)} />
          <StrengthMeter value={pw} />
        </div>
        <div className="flex gap-2.5 rounded-xl border border-line bg-bg/60 p-3 text-xs text-mute">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <p>Every new account starts as an <span className="font-semibold text-ink">Inspector</span> and can use the app right away. An admin can change roles later.</p>
        </div>
        <Feedback err={f.err} msg={f.msg} />
        <Submit busy={f.busy} idle="Create account" loading="Creating..." />
      </form>
      <Switch text="Already registered?" to="/login" label="Sign in" />
    </Shell>
  );
}

export function Forgot() {
  const f = useAuthForm(async email => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset` });
    return error ? error.message : "!If that email exists, a reset link has been sent.";
  });
  return (
    <Shell icon={KeyRound} title="Reset password" sub="Enter your email and we will send you a reset link.">
      <form onSubmit={f.submit} className="space-y-4">
        <Field id="email" name="email" type="email" label="Email" icon={Mail} required autoComplete="email" placeholder="you@company.com" />
        <Feedback err={f.err} msg={f.msg} />
        <Submit busy={f.busy} idle="Send reset link" loading="Sending..." />
      </form>
      <Switch text="Remembered it?" to="/login" label="Back to sign in" />
    </Shell>
  );
}

export function ResetPassword() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const f = useAuthForm(async (_e, password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return error.message; nav("/"); return null;
  });
  return (
    <Shell icon={Lock} title="Choose a new password" sub="Open this page from the link in your reset email.">
      <form onSubmit={f.submit} className="space-y-4">
        <input name="email" type="hidden" value="x" />
        <div>
          <Field id="password" name="password" type="password" label="New password" icon={Lock} minLength={8} required autoComplete="new-password" placeholder="At least 8 characters"
            onChange={e => setPw(e.target.value)} />
          <StrengthMeter value={pw} />
        </div>
        <Feedback err={f.err} msg={f.msg} />
        <Submit busy={f.busy} idle="Update password" loading="Updating..." />
      </form>
    </Shell>
    );
}
    
