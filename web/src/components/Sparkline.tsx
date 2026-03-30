"use client";

export default function Sparkline({
  data,
  color,
}: {
  data: number[];
  color: string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const w = 280;
  const h = 32;
  const step = w / Math.max(data.length - 1, 1);
  const points = data
    .map((v, i) => `${i * step},${h - (v / max) * (h - 4)}`)
    .join(" ");
  const area = `0,${h} ${points} ${(data.length - 1) * step},${h}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-8">
      <polyline points={area} fill={color} opacity={0.08} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
