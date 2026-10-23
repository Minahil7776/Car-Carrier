"use client";

import { useState } from "react";

export function TrendChart({ data, unit }: { data: { label: string; value: number }[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600, H = 220, L = 30, R = 14, T = 16, B = 28;
  const peak = Math.max(...data.map((d) => d.value), 1);
  const max = Math.max(4, Math.ceil(peak / 2) * 2);
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, data.length - 1);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);

  // Smooth line through the points
  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  const line = pts.reduce((p, [px, py], i) => {
    if (i === 0) return `M${px},${py}`;
    const [qx, qy] = pts[i - 1];
    const mx = (qx + px) / 2;
    return `${p} C${mx},${qy} ${mx},${py} ${px},${py}`;
  }, "");
  const area = `${line} L${x(data.length - 1)},${H - B} L${x(0)},${H - B} Z`;
  const total = data.reduce((n, d) => n + d.value, 0);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.min(data.length - 1, Math.max(0, Math.round(((px - L) / (W - L - R)) * (data.length - 1)))));
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${unit} per month over the last ${data.length} months, ${total} in total`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgb(var(--brand))" stopOpacity=".22" />
            <stop offset="1" stopColor="rgb(var(--brand))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, max / 2, max].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="rgb(var(--line))" strokeDasharray={v === 0 ? undefined : "3 4"} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="rgb(var(--faint))">{v}</text>
          </g>
        ))}
        <path d={area} fill="url(#trend-fill)" />
        <path d={line} fill="none" stroke="rgb(var(--brand))" strokeWidth="2.5" strokeLinecap="round" />
        {data.map((d, i) => (
          <text key={d.label + i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={hover === i ? "rgb(var(--ink))" : "rgb(var(--faint))"}>{d.label}</text>
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="rgb(var(--faint))" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(data[hover].value)} r="5" fill="rgb(var(--surface))" stroke="rgb(var(--brand))" strokeWidth="2.5" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-pop" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(data[hover].value) / H) * 100 - 16}%` }}>
          <span className="font-semibold">{data[hover].value}</span> <span className="text-muted">{unit} in {data[hover].label}</span>
        </div>
      )}
    </div>
  );
}
