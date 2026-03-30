"use client";

import { useEffect, useState, useCallback } from "react";
import type { StatusResponse } from "@/lib/api";
import { fetchStatus } from "@/lib/api";
import { dict, type Locale } from "@/lib/i18n";
import ModelCard from "./ModelCard";

export default function Dashboard({ locale }: { locale: Locale }) {
  const t = dict[locale];
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const d = await fetchStatus();
    if (d) setData(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (loading) {
    return (
      <div className="text-center text-neutral-500 dark:text-neutral-600 font-mono text-sm py-12">
        {t.connecting}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-neutral-500 dark:text-neutral-600 font-mono text-sm py-12">
        {t.failed}
      </div>
    );
  }

  const sorted = [...data.models].sort((a, b) => {
    if (a.fuck_score === 0 && b.fuck_score === 0) return 0;
    if (a.fuck_score === 0) return 1;
    if (b.fuck_score === 0) return -1;
    return a.fuck_score - b.fuck_score;
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-neutral-200 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
      {sorted.map((m) => (
        <ModelCard
          key={m.model}
          model={m}
          hourBucket={data.hour_bucket}
          locale={locale}
          onRefresh={refresh}
        />
      ))}
    </div>
  );
}
