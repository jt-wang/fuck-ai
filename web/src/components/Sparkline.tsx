"use client";

import { useState } from "react";
import { formatHourLabel } from "@/lib/format";

export default function Sparkline({
  data,
  labels,
  color,
}: {
  data: number[];
  labels?: string[];
  color: string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const w = 280;
  const h = 32;
  const step = w / Math.max(data.length - 1, 1);
  const points = data
    .map((v, i) => `${i * step},${h - (v / max) * (h - 4)}`)
    .join(" ");
  const area = `0,${h} ${points} ${(data.length - 1) * step},${h}`;

  const hoverX = hoverIdx !== null ? hoverIdx * step : 0;
  const hoverY = hoverIdx !== null ? h - (data[hoverIdx] / max) * (h - 4) : 0;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="w-full h-8"
        onMouseLeave={() => setHoverIdx(null)}
      >
        <polyline points={area} fill={color} opacity={0.08} />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Invisible hit areas per data point */}
        {data.map((_, i) => (
          <rect
            key={i}
            x={i * step - step / 2}
            y={0}
            width={step}
            height={h}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
          />
        ))}
        {/* Hover dot */}
        {hoverIdx !== null && (
          <circle cx={hoverX} cy={hoverY} r={2.5} fill={color} />
        )}
      </svg>
      {/* Tooltip */}
      {hoverIdx !== null && labels && labels[hoverIdx] && (
        <div
          className="absolute -top-7 pointer-events-none px-1.5 py-0.5 rounded bg-neutral-800 dark:bg-neutral-700 text-[10px] font-mono text-neutral-100 whitespace-nowrap"
          style={{
            left: `${(hoverIdx / Math.max(data.length - 1, 1)) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          {formatHourLabel(labels[hoverIdx])} · {data[hoverIdx]}
        </div>
      )}
    </div>
  );
}
