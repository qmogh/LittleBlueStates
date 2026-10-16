import { useState, type ReactNode } from "react";

// Hand-rolled SVG charts for the story. One y-axis per chart, 2px lines, hairline grid,
// hover readout, and a table view for every chart.

export const BRAND = "#3459a3";
export const GENERIC = "#b07d22";
export const CONTEXT = "#8b877c";

export type Point = { x: number; y: number | null };
export type Series = { name: string; color: string; points: Point[] };
export type Marker = { x: number; label: string };

const W = 640;
const PAD = { top: 18, right: 18, bottom: 28, left: 56 };

function extent(values: number[]) {
  return [Math.min(...values), Math.max(...values)];
}

function niceTicks(max: number, count = 4) {
  const step = 10 ** Math.floor(Math.log10(max / count));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => max / s <= count) ?? step * 10;
  return Array.from({ length: Math.floor(max / nice) + 1 }, (_, i) => i * nice);
}

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <div className="legend">
      {series.map((s) => (
        <span key={s.name}>
          <i style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

export function LineChart({
  series,
  height = 260,
  log = false,
  yMax,
  formatY,
  formatX,
  formatTipX = formatX,
  xTicks,
  markers = [],
  label,
}: {
  series: Series[];
  height?: number;
  log?: boolean;
  yMax?: number;
  formatY: (value: number) => string;
  formatX: (value: number) => string;
  formatTipX?: (value: number) => string;
  xTicks: number[];
  markers?: Marker[];
  label: string;
}) {
  const [hoverX, setHoverX] = useState<number | null>(null);
  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b);
  const ys = series.flatMap((s) => s.points.map((p) => p.y).filter((y): y is number => y !== null && y > 0));
  const [xMin, xMax] = extent(xs);
  const yTop = yMax ?? Math.max(...ys);
  const yTicks = log
    ? Array.from({ length: 12 }, (_, i) => 10 ** (i - 2)).filter((t) => t >= Math.min(...ys) / 1.5 && t <= yTop * 1.5)
    : niceTicks(yTop);
  const [lo, hi] = log ? [Math.log10(yTicks[0]), Math.log10(yTicks.at(-1)!)] : [0, yTicks.at(-1)!];
  const x = (v: number) => PAD.left + ((v - xMin) / (xMax - xMin || 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    height - PAD.bottom - (((log ? Math.log10(v) : v) - lo) / (hi - lo)) * (height - PAD.top - PAD.bottom);
  const nearest = hoverX === null ? null : xs.reduce((a, b) => (Math.abs(b - hoverX) < Math.abs(a - hoverX) ? b : a));

  return (
    <figure className="chart">
      <Legend series={series} />
      <div className="chart-frame">
        <svg
          viewBox={`0 0 ${W} ${height}`}
          role="img"
          aria-label={label}
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            const px = ((event.clientX - box.left) / box.width) * W;
            setHoverX(xMin + ((px - PAD.left) / (W - PAD.left - PAD.right)) * (xMax - xMin));
          }}
          onPointerLeave={() => setHoverX(null)}
        >
          {yTicks.map((t) => (
            <g key={t} className="grid">
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
                {formatY(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} className="tick" x={x(t)} y={height - 8} textAnchor="middle">
              {formatX(t)}
            </text>
          ))}
          {markers.map((m) => (
            <g key={m.label} className="marker">
              <line x1={x(m.x)} x2={x(m.x)} y1={PAD.top} y2={height - PAD.bottom} />
              <text x={x(m.x) + 4} y={PAD.top + 8}>
                {m.label}
              </text>
            </g>
          ))}
          {series.map((s) => {
            const segments: Point[][] = [[]];
            for (const p of s.points) {
              if (p.y === null || (log && p.y <= 0)) segments.push([]);
              else segments.at(-1)!.push(p);
            }
            return segments
              .filter((seg) => seg.length)
              .map((seg, i) => (
                <polyline
                  key={`${s.name}-${i}`}
                  className="line"
                  style={{ stroke: s.color }}
                  points={seg.map((p) => `${x(p.x)},${y(p.y!)}`).join(" ")}
                />
              ));
          })}
          {nearest !== null && (
            <g className="hover">
              <line x1={x(nearest)} x2={x(nearest)} y1={PAD.top} y2={height - PAD.bottom} />
              {series.map((s) => {
                const p = s.points.find((point) => point.x === nearest);
                return p?.y != null && (!log || p.y > 0) ? (
                  <circle key={s.name} cx={x(nearest)} cy={y(p.y)} r={4.5} style={{ fill: s.color }} />
                ) : null;
              })}
            </g>
          )}
        </svg>
        {nearest !== null && (
          <div className="chart-tip" style={{ left: `${(x(nearest) / W) * 100}%` }}>
            <strong>{formatTipX(nearest)}</strong>
            {series.map((s) => {
              const p = s.points.find((point) => point.x === nearest);
              return p?.y != null ? (
                <span key={s.name}>
                  <i style={{ background: s.color }} />
                  {s.name}: {formatY(p.y)}
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>
    </figure>
  );
}

export function ColumnChart({
  data,
  color,
  height = 220,
  formatY,
  highlight,
  label,
}: {
  data: Array<{ x: number; y: number }>;
  color: string;
  height?: number;
  formatY: (value: number) => string;
  highlight?: number;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const ticks = niceTicks(Math.max(...data.map((d) => d.y)));
  const top = ticks.at(-1)!;
  const padTop = highlight === undefined ? PAD.top : 34;
  const band = (W - PAD.left - PAD.right) / data.length;
  const barW = Math.min(24, band - 6);
  const y = (v: number) => height - PAD.bottom - (v / top) * (height - padTop - PAD.bottom);
  const active = data.find((d) => d.x === hover);
  return (
    <figure className="chart">
      <div className="chart-frame">
        <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t} className="grid">
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
                {formatY(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = PAD.left + band * i + band / 2;
            const h = height - PAD.bottom - y(d.y);
            const r = Math.min(4, h / 2);
            return (
              <g key={d.x} onPointerEnter={() => setHover(d.x)}>
                <rect className="hit" x={cx - band / 2} y={padTop} width={band} height={height - padTop - PAD.bottom} />
                <path
                  className="bar"
                  style={{ fill: color, opacity: hover === null || hover === d.x ? 1 : 0.55 }}
                  d={`M${cx - barW / 2},${y(0)} V${y(d.y) + r} q0,${-r} ${r},${-r} H${cx + barW / 2 - r} q${r},0 ${r},${r} V${y(0)} Z`}
                />
                {d.x === highlight && (
                  <text className="bar-label" x={cx} y={y(d.y) - 6} textAnchor="middle">
                    {formatY(d.y)}
                  </text>
                )}
                {(i === 0 || i === data.length - 1 || i % 2 === 0) && (
                  <text className="tick" x={cx} y={height - 8} textAnchor="middle">
                    {d.x}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {active && (
          <div className="chart-tip" style={{ left: `${((PAD.left + band * data.indexOf(active) + band / 2) / W) * 100}%` }}>
            <strong>{active.x}</strong>
            <span>{formatY(active.y)}</span>
          </div>
        )}
      </div>
    </figure>
  );
}

// Dots on a log axis: for comparing prices that differ by orders of magnitude.
export function DotPlot({
  rows,
  formatX,
  label,
}: {
  rows: Array<{ label: string; value: number; color: string; note?: string }>;
  formatX: (value: number) => string;
  label: string;
}) {
  const rowH = 38;
  const height = rows.length * rowH + 34;
  const left = 230;
  const ticks = [0.01, 0.1, 1, 10, 100];
  const x = (v: number) => left + ((Math.log10(v) + 2) / 4) * (W - left - PAD.right);
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t} className="grid">
            <line x1={x(t)} x2={x(t)} y1={8} y2={height - 26} />
            <text x={x(t)} y={height - 8} textAnchor="middle">
              {formatX(t)}
            </text>
          </g>
        ))}
        {rows.map((row, i) => (
          <g key={row.label} transform={`translate(0 ${i * rowH + 26})`}>
            <text className="row-label" x={0} y={4}>
              {row.label}
            </text>
            <line className="stem" x1={x(0.01)} x2={x(row.value)} y1={0} y2={0} />
            <circle cx={x(row.value)} cy={0} r={6} style={{ fill: row.color }}>
              <title>{`${row.label}: ${formatX(row.value)}`}</title>
            </circle>
            <text
              className="dot-label"
              x={x(row.value) + (x(row.value) > W - 90 ? -12 : 12)}
              y={-10 + (x(row.value) > W - 90 ? 0 : 14)}
              textAnchor={x(row.value) > W - 90 ? "end" : "start"}
            >
              {formatX(row.value)}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

export function DataTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <details className="data-table">
      <summary>Show the numbers</summary>
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
