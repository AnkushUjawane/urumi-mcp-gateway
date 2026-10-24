import { useCallback, useEffect, useState } from "react";

// Calls `load` now and then every `intervalMs`. `load` must be a stable function (defined outside components).
export function usePolling<T>(load: () => Promise<T>, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try { setData(await load()); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [load]);

  useEffect(() => {
    reload();
    const t = setInterval(reload, intervalMs);
    return () => clearInterval(t);
  }, [reload, intervalMs]);

  return { data, error, loading, reload };
}
