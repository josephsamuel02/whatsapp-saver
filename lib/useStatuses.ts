import { useCallback, useEffect, useState } from "react";
import { StatusFile, listStatuses } from "./statusService";
import type { MediaType } from "./statusService";

export function useStatuses(filter?: MediaType) {
  const [files, setFiles] = useState<StatusFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await listStatuses(filter);
      setFiles(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  return { files, loading, refreshing, error, refresh, reload: load };
}
