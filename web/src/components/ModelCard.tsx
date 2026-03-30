"use client";

import { useEffect, useState } from "react";
import type { ModelStatus } from "@/lib/api";
import { fetchModelDetail, submitFuck } from "@/lib/api";
import { dict, type Locale } from "@/lib/i18n";
import Sparkline from "./Sparkline";

const STATUS_COLORS: Record<string, string> = {
  genius: "#00ff88",
  smart: "#4488ff",
  normal: "#888888",
  dumb: "#ff8800",
  braindead: "#ff2222",
  unknown: "#555555",
};

export default function ModelCard({
  model,
  hourBucket,
  locale,
  onRefresh,
}: {
  model: ModelStatus;
  hourBucket: string;
  locale: Locale;
  onRefresh: () => void;
}) {
  const t = dict[locale];
  const color = STATUS_COLORS[model.status] || STATUS_COLORS.unknown;
  const score = model.fuck_score > 0 ? `${model.fuck_score}` : "?";
  const fuckedKey = `fucked:${model.model}:${hourBucket}`;
  const [fucked, setFucked] = useState(false);
  const [sparkData, setSparkData] = useState<number[]>([]);

  useEffect(() => {
    setFucked(!!localStorage.getItem(fuckedKey));
  }, [fuckedKey]);

  useEffect(() => {
    fetchModelDetail(model.model).then((d) => {
      if (d?.hours) setSparkData(d.hours.map((h) => h.fuck_count));
    });
  }, [model.model]);

  async function handleFuck(e: React.MouseEvent) {
    e.stopPropagation();
    await submitFuck(model.model);
    localStorage.setItem(fuckedKey, "1");
    setFucked(true);
    onRefresh();
  }

  return (
    <div className="p-4 md:p-5 bg-white dark:bg-neutral-950 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-sm font-semibold tracking-tight dark:text-neutral-100 text-neutral-900">
            {model.display_name}
          </div>
          <div className="text-[11px] text-neutral-400 dark:text-neutral-600">
            {model.provider}
          </div>
        </div>
        <div className="font-mono text-3xl font-extrabold tracking-tighter" style={{ color }}>
          {score}
          <span className="text-xs font-normal text-neutral-400 dark:text-neutral-600">/5</span>
        </div>
      </div>

      <div className="flex justify-between items-center mt-1">
        <span className="font-mono text-xs text-neutral-500 dark:text-neutral-500">
          {model.current_fucks} {t.fucks_hr}
        </span>
        <span
          className="font-mono text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border"
          style={{ color, borderColor: color }}
        >
          {model.status}
        </span>
      </div>

      {sparkData.length > 0 && (
        <div className="mt-2">
          <Sparkline data={sparkData} color={color} />
        </div>
      )}

      <button
        onClick={handleFuck}
        className={`w-full mt-2 py-1.5 text-xs font-mono rounded border transition-all active:scale-[0.98] ${
          fucked
            ? "bg-red-500/10 border-red-900/30 text-red-400 dark:bg-red-500/10 dark:border-red-900/30 dark:text-red-400"
            : "border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-600 hover:border-red-500 hover:text-red-500 hover:bg-red-500/5 dark:hover:border-red-500 dark:hover:text-red-500 dark:hover:bg-red-500/5"
        }`}
      >
        {fucked ? t.fucked_btn : t.fuck_btn}
      </button>
    </div>
  );
}
