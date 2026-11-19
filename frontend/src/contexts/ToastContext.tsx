import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
type T = { id: number; kind: "success" | "error"; text: string };
const Ctx = createContext<{ notify: (kind: T["kind"], text: string) => void }>(null!);
export const useToast = () => useContext(Ctx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const notify = useCallback((kind: T["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setItems(i => [...i, { id, kind, text }]);
    setTimeout(() => setItems(i => i.filter(x => x.id !== id)), 5000);
  }, []);
  return (
    <Ctx.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" role="status" aria-live="polite">
        {items.map(t => (
          <div key={t.id} className="card flex items-start gap-3 p-3 text-sm shadow-xl">
            {t.kind === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-bad" />}
            <span className="flex-1">{t.text}</span>
            <button onClick={() => setItems(i => i.filter(x => x.id !== t.id))} aria-label="Dismiss"><X className="h-4 w-4 text-mute" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
