"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type { StatusResponse } from "@/lib/api";
import { fetchStatus } from "@/lib/api";
import { dict, type Locale } from "@/lib/i18n";
import ModelCard from "./ModelCard";

import { sortModels, type SortMode } from "@/lib/sort";

export default function Dashboard({ locale }: { locale: Locale }) {
  const t = dict[locale];
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("score");

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

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.toLowerCase();
    const models = q
      ? data.models.filter(
          (m) =>
            m.display_name.toLowerCase().includes(q) ||
            m.provider.toLowerCase().includes(q) ||
            m.model.toLowerCase().includes(q),
        )
      : data.models;

    return sortModels(models, sortMode);
  }, [data, query, sortMode]);

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

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.search}
          className="flex-1 px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-mono text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 outline-none focus:border-neutral-500 dark:focus:border-neutral-500"
        />
        <button
          onClick={() => setSortMode("score")}
          className={`px-3 py-2 rounded-md text-xs font-mono border transition-colors ${
            sortMode === "score"
              ? "border-neutral-500 text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800"
              : "border-neutral-300 dark:border-neutral-700 text-neutral-400 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-400"
          }`}
        >
          {t.sort_score}
        </button>
        <button
          onClick={() => setSortMode("name")}
          className={`px-3 py-2 rounded-md text-xs font-mono border transition-colors ${
            sortMode === "name"
              ? "border-neutral-500 text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800"
              : "border-neutral-300 dark:border-neutral-700 text-neutral-400 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-400"
          }`}
        >
          {t.sort_name}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-neutral-200 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
        {filtered.map((m) => (
          <ModelCard
            key={m.model}
            model={m}
            hourBucket={data.hour_bucket}
            locale={locale}
            onRefresh={refresh}
          />
        ))}
      </div>
    </div>
  );
}
