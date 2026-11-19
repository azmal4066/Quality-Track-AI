import { supabase } from "./supabase";
const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, public detail: any) {
    super(typeof detail === "string" ? detail : detail?.message ?? `Request failed (${status})`);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.detail ?? body);
  return body as T;
}

export async function downloadPost(path: string, json: unknown, fallbackName: string) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}) }, body: JSON.stringify(json) });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new ApiError(res.status, b.detail ?? b); }
  const cd = res.headers.get("Content-Disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

export const api = {
  get: <T,>(p: string) => request<T>(p),
  post: <T,>(p: string, json: unknown) => request<T>(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json) }),
  put: <T,>(p: string, json: unknown) => request<T>(p, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json) }),
  del: <T,>(p: string) => request<T>(p, { method: "DELETE" }),
  upload: <T,>(p: string, form: FormData) => request<T>(p, { method: "POST", body: form }),
};
