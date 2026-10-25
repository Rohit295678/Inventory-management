"use client";
import { useCallback, useEffect, useState } from "react";

// Tiny fetch layer for the web UI (cookie session auth). The mobile app will
// have its own equivalent that adds the Bearer header — same endpoints.

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong");

// Load `path` and re-load whenever it changes. `path = null` pauses loading.
// `loading` is derived (has the current request finished?) rather than set
// inside the effect, and stale data stays visible while a reload is in flight.
export function useApi<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{ key: string; data: T | null; error: string } | null>(null);
  const key = path === null ? null : `${path}#${version}`;

  useEffect(() => {
    if (path === null || key === null) return;
    let cancelled = false;
    api<T>(path)
      .then((data) => {
        if (!cancelled) setResult({ key, data, error: "" });
      })
      .catch((e) => {
        if (!cancelled) setResult((prev) => ({ key, data: prev?.data ?? null, error: errorMessage(e) }));
      });
    return () => {
      cancelled = true;
    };
  }, [path, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return {
    data: result?.data ?? null,
    error: result?.error ?? "",
    loading: key !== null && result?.key !== key,
    reload,
  };
}
