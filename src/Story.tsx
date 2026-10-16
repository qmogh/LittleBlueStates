import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import law from "./data/story/01-law.json";
import miami from "./data/story/02-miami.json";
import cliff from "./data/story/03-patent-cliff.json";
import brand from "./data/story/04-brand-price.json";
import whoPays from "./data/story/05-who-pays.json";
import cash from "./data/story/06-cash.json";
import snapshot from "./data/sildenafil-2024.json";
import { path, projection, topologyStates } from "./geo";

// Every number in the copy is read from src/data/story/*.json (built by `npm run data:story`
// from sql/*.sql). Each step names its source; the full ledger is in Show your work.

type Row = Record<string, number | string | boolean | null>;
type StoryFile = { outputs: Record<string, unknown> };

function rows(file: StoryFile, key: string) {
  return file.outputs[key] as Row[];
}
function pick(file: StoryFile, key: string, where: Row = {}) {
  const found = rows(file, key).find((row) =>
    Object.entries(where).every(([k, v]) => row[k] === v),
  );
  if (!found) throw new Error(`No ${key} row matching ${JSON.stringify(where)}`);
  return found;
}
const n = (value: unknown) => Number(value);
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pct = (value: unknown, digits = 0) => `${(n(value) * 100).toFixed(digits)}%`;
const usd = (value: unknown, digits = 2) =>
  `$${n(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

const BLUE = "#3459a3";
const OCHRE = "#b07d22";

const fipsToCode = new Map(snapshot.states.map((s) => [s.fips, s.code]));

// ---------------------------------------------------------------------------------------------
// Scrollytelling scaffold: a sticky graphic, step cards scrolling over it. Native scroll only.

function useActiveStep(count: number) {
  const refs = useRef<Array<HTMLDivElement | null>>([]);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    refs.current.slice(0, count).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [count]);
  return { refs, active };
}

type Step = { text: ReactNode; source: string };

function Scrolly({ steps, graphic }: { steps: Step[]; graphic: (active: number) => ReactNode }) {
  const { refs, active } = useActiveStep(steps.length);
  return (
    <div className="scrolly">
      <div className="scrolly-graphic">{graphic(active)}</div>
      <div className="scrolly-steps">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`step ${i === active ? "active" : ""}`}
            data-step={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
          >
            <div className="step-card">
              <p>{step.text}</p>
              <small className="source-line">{step.source}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// The story map: one sequential hue per act, optional zoom to Florida and a Miami marker.

const RAMPS = {
  blue: ["#efe9dc", "#1f3f86"],
  ochre: ["#efe9dc", "#7f560f"],
} as const;

function mix(from: string, to: string, t: number) {
  const a = from.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  const b = to.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
}

const stateRates = rows(miami, "state_rates");
const floridaShape = topologyStates.features.find((f) => String(f.id).padStart(2, "0") === "12")!;
const [[flMinX, flMinY], [flMaxX, flMaxY]] = path.bounds(floridaShape);
const MIAMI = projection([-80.19, 25.76])!;

type MapState = {
  year: number;
  metric: "viagra_per_1000" | "claims_per_1000";
  ramp: keyof typeof RAMPS;
  max: number;
  zoom?: boolean;
  miami?: boolean;
  callout?: ReactNode;
  legend: string;
};

function StoryMap({ state }: { state: MapState }) {
  const values = new Map(
    stateRates.filter((r) => r.year === state.year).map((r) => [r.state as string, n(r[state.metric])]),
  );
  const [lo, hi] = RAMPS[state.ramp];
  const k = state.zoom ? Math.min(560 / (flMaxX - flMinX), 420 / (flMaxY - flMinY)) : 1;
  const cx = state.zoom ? (flMinX + flMaxX) / 2 : 480;
  const cy = state.zoom ? (flMinY + flMaxY) / 2 : 310;
  return (
    <figure className="story-map">
      <svg viewBox="0 0 960 620" role="img" aria-label={state.legend}>
        <g
          className="story-map-layer"
          style={{ transform: `translate(480px, 310px) scale(${k}) translate(${-cx}px, ${-cy}px)` }}
        >
          {topologyStates.features.map((shape) => {
            const code = fipsToCode.get(String(shape.id).padStart(2, "0"));
            const value = code ? (values.get(code) ?? 0) : 0;
            return (
              <path
                key={String(shape.id)}
                d={path(shape) ?? undefined}
                style={{ fill: mix(lo, hi, Math.sqrt(Math.min(value / state.max, 1))), strokeWidth: 1 / k }}
              >
                <title>{`${code ?? ""}: ${value.toFixed(1)} per 1,000 people`}</title>
              </path>
            );
          })}
          {state.miami && (
            <g className="miami">
              <circle cx={MIAMI[0]} cy={MIAMI[1]} r={9 / k} />
              <text x={MIAMI[0] - 14 / k} y={MIAMI[1] + 4 / k} style={{ fontSize: 13 / k }} textAnchor="end">
                Miami &amp; Hialeah
              </text>
            </g>
          )}
        </g>
      </svg>
      {state.callout && <div className="map-callout">{state.callout}</div>}
      <figcaption className="map-legend">
        <i style={{ background: `linear-gradient(90deg, ${lo}, ${hi})` }} />
        <span>{state.legend}</span>
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------------------------

export function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(max > 0 ? window.scrollY / max : 0);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return <div className="progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />;
}

// The headline's period is a pill. Pull it out and drop it anywhere on the page; a new one
// takes its place.

function PillShape() {
  return (
    <svg viewBox="0 0 64 46" aria-hidden="true">
      <path className="pill-side" d="M32 7 L60 26 L32 45 L4 26 Z" />
      <path className="pill-edge" d="M32 4 L60 23 L32 42 L4 23 Z" />
      <path className="pill-face" d="M32 9 L53 23 L32 37 L11 23 Z" />
      <ellipse className="pill-gloss" cx="25" cy="17" rx="9" ry="3.2" transform="rotate(-34 25 17)" />
    </svg>
  );
}

function PillDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <linearGradient id="pill-edge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5f8be0" />
          <stop offset="1" stopColor="#24468f" />
        </linearGradient>
        <linearGradient id="pill-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7aa2ee" />
          <stop offset="0.55" stopColor="#4672cc" />
          <stop offset="1" stopColor="#3459a3" />
        </linearGradient>
        <filter id="pill-blur">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>
    </svg>
  );
}

type LoosePill = { id: number; x: number; y: number; w: number; h: number; tilt: number };

function usePills() {
  const [pills, setPills] = useState<LoosePill[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);
  const grab = useRef({ dx: 0, dy: 0 });
  const nextId = useRef(1);

  useEffect(() => {
    if (dragging === null) return;
    const move = (e: PointerEvent) =>
      setPills((all) =>
        all.map((p) => (p.id === dragging ? { ...p, x: e.pageX - grab.current.dx, y: e.pageY - grab.current.dy } : p)),
      );
    const up = () => setDragging(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging]);

  // Pick up a loose pill where it lies.
  function pickUp(e: ReactPointerEvent, pill: LoosePill) {
    e.preventDefault();
    grab.current = { dx: e.pageX - pill.x, dy: e.pageY - pill.y };
    setPills((all) => [...all.filter((p) => p.id !== pill.id), pill]);
    setDragging(pill.id);
  }
  // Pull a new pill out of the headline.
  function pullOut(e: ReactPointerEvent<HTMLElement>) {
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const pill = {
      id: nextId.current++,
      x: r.left + window.scrollX,
      y: r.top + window.scrollY,
      w: r.width,
      h: r.height,
      tilt: Math.round(Math.random() * 50 - 25),
    };
    grab.current = { dx: e.pageX - pill.x, dy: e.pageY - pill.y };
    setPills((all) => [...all, pill]);
    setDragging(pill.id);
  }
  return { pills, dragging, pickUp, pullOut };
}

export function ColdOpen() {
  const claims = n(pick(law, "viagra_by_year", { year: 2013 }).claims);
  const { pills, dragging, pickUp, pullOut } = usePills();
  return (
    <section id="top" className="cold-open">
      <PillDefs />
      <div className="cold-text">
        <h1>
          Medicare isn't allowed to pay for&nbsp;Viagra
          <span className={`pill pill-slot ${pills.length ? "" : "untouched"}`} onPointerDown={pullOut}>
            <PillShape />
          </span>
        </h1>
        <p className="cold-lede">
          Since 2007, federal law has barred Medicare's prescription drug
          coverage from paying for erectile dysfunction drugs.
        </p>
        <p className="cold-number">{int.format(claims)}</p>
        <p className="cold-caption">
          Viagra prescriptions and refills went through Medicare drug plans in
          2013 anyway.
        </p>
        <p className="cold-lede">
          The law has a loophole. Medicare drug plans are sold by private
          insurers, and they're allowed to add Viagra as an optional extra,
          outside the standard benefit. In one state, most of them did.
        </p>
      </div>
      {createPortal(
        pills.map((p) => (
          <span
            key={p.id}
            className={`pill loose ${dragging === p.id ? "dragging" : ""}`}
            style={{ left: p.x, top: p.y, width: p.w, height: p.h, rotate: `${p.tilt}deg` }}
            onPointerDown={(e) => pickUp(e, p)}
          >
            <PillShape />
          </span>
        )),
        document.body,
      )}
    </section>
  );
}

function ActOne() {
  const r = (y: number) => pick(miami, "florida_vs_rest", { year: y });
  const peak = rows(miami, "florida_share").reduce((a, b) =>
    n(b.fl_share_of_viagra) > n(a.fl_share_of_viagra) ? b : a,
  );
  const mh = rows(miami, "miami_share").filter((x) => n(x.year) <= 2018);
  const mhLo = Math.min(...mh.map((x) => n(x.miami_hialeah_share)));
  const mhHi = Math.max(...mh.map((x) => n(x.miami_hialeah_share)));
  const cov = (area: string) => pick(miami, "plan_coverage", { plan_year: 2019, area });
  const max = Math.max(...rows(miami, "florida_vs_rest").map((x) => n(x.fl_viagra_per_1000)));
  const legend = "Viagra prescriptions per 1,000 people in Medicare drug plans";
  const maps: MapState[] = [
    { year: 2013, metric: "viagra_per_1000", ramp: "blue", max, legend,
      callout: <><b>{n(r(2013).viagra_ratio)}×</b><span>Florida's rate vs. the rest of the country, 2013</span></> },
    { year: 2015, metric: "viagra_per_1000", ramp: "blue", max, legend,
      callout: <><b>{n(r(2015).viagra_ratio)}×</b><span>2015</span></> },
    { year: 2015, metric: "viagra_per_1000", ramp: "blue", max, legend, zoom: true, miami: true,
      callout: <><b>{pct(mhLo)}–{pct(mhHi)}</b><span>of Florida's Viagra prescriptions, every year through 2018</span></> },
    { year: 2019, metric: "viagra_per_1000", ramp: "blue", max, legend, zoom: true, miami: true,
      callout: <><b>{pct(cov("Miami-Dade").covering_share)}</b><span>of Miami-Dade plans covered Viagra or its generic in 2019. Elsewhere: {pct(cov("Rest of US").covering_share, 1)}</span></> },
  ];
  const steps: Step[] = [
    { text: <>In 2013, Florida prescribers wrote {n(r(2013).fl_viagra_per_1000).toFixed(1)} Viagra prescriptions for every 1,000 people in a Medicare drug plan there. The rest of the country: {n(r(2013).rest_viagra_per_1000).toFixed(1)}.</>,
      source: "CMS Medicare Part D" },
    { text: <>By {n(peak.year)}, Florida accounted for {pct(peak.fl_share_of_viagra)} of Medicare's Viagra prescriptions, with {pct(peak.fl_share_of_partd_enrollees, 1)} of its drug-plan members.</>,
      source: "CMS Medicare Part D" },
    { text: <>About half of Florida's came from prescribers in two cities: Miami and Hialeah.</>,
      source: "CMS Medicare Part D" },
    { text: <>In 2019, the first year plan details are public, {pct(cov("Miami-Dade").covering_share)} of the drug plans sold in Miami-Dade covered Viagra or its generic as an extra. In the rest of the country, {pct(cov("Rest of US").covering_share, 1)} did.</>,
      source: "CMS Medicare Part D plan formularies" },
  ];
  return (
    <section className="act" id="florida">
      <header className="act-head">
        <h2>In {n(peak.year)}, {pct(peak.fl_share_of_viagra)} of Medicare's Viagra prescriptions came from Florida.</h2>
      </header>
      <Scrolly steps={steps} graphic={(i) => <StoryMap state={maps[i]} />} />
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Act 2: the reader draws the brand price after the generic arrives, then sees what happened.

const GW = 720;
const GH = 380;
const GP = { top: 24, right: 24, bottom: 32, left: 52 };
const CUTOFF = "2017-12-01";

function PriceGuess() {
  const monthly = rows(cliff, "nadac_monthly");
  const series = (b: string) =>
    new Map(monthly.filter((r) => r.brand === b && n(r.mg) === 100).map((r) => [String(r.month), n(r.per_tablet)]));
  const brandPrice = series("Viagra");
  const genericPrice = series("Generic");
  const months = [...brandPrice.keys()].sort();
  const cut = months.indexOf(CUTOFF);
  const [guess, setGuess] = useState<Array<number | null>>(() => months.map(() => null));
  const [revealed, setRevealed] = useState(false);
  const last = useRef<number | null>(null);

  const x = (i: number) => GP.left + (i / (months.length - 1)) * (GW - GP.left - GP.right);
  const y = (v: number) => GH - GP.bottom - (v / 100) * (GH - GP.top - GP.bottom);
  const line = (values: Array<number | undefined | null>) =>
    values.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(" ");

  const drawn = guess.filter((v, i) => i > cut && v !== null).length;
  const ready = drawn >= 0.8 * (months.length - 1 - cut);
  const lastIdx = months.length - 1;
  // The pharmacy-price survey first lists the generic a few months after launch.
  const firstGeneric = months.findIndex((m) => genericPrice.has(m));
  const guessAtEnd = guess[lastIdx] ?? [...guess].reverse().find((v) => v !== null) ?? null;

  function draw(event: ReactPointerEvent<SVGSVGElement>) {
    if (revealed || (event.type === "pointermove" && event.buttons !== 1)) return;
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * GW;
    const py = ((event.clientY - box.top) / box.height) * GH;
    const i = Math.round(((px - GP.left) / (GW - GP.left - GP.right)) * (months.length - 1));
    if (i <= cut || i > lastIdx) return;
    const v = Math.max(0, Math.min(100, ((GH - GP.bottom - py) / (GH - GP.top - GP.bottom)) * 100));
    // Read the previous point now: the state updater runs later, after last.current moves on.
    const from = last.current ?? cut;
    setGuess((g) => {
      const next = [...g];
      next[cut] = brandPrice.get(CUTOFF)!;
      const fromV = next[from] ?? v;
      const [a, b] = from < i ? [from, i] : [i, from];
      for (let j = a; j <= b; j += 1) next[j] = b === a ? v : from < i ? fromV + ((v - fromV) * (j - a)) / (b - a) : v + ((fromV - v) * (j - a)) / (b - a);
      return next;
    });
    last.current = i;
  }

  const latestBrand = rows(brand, "brand_vs_generic").at(-1)!;
  const cp100 = rows(cash, "costplus").find((r) => r.strength === "100mg")!;
  const b2017 = pick(brand, "brand_vs_generic", { year: 2017 });
  const b2024 = pick(brand, "brand_vs_generic", { year: 2024 });
  const weeks = rows(cliff, "cliff_weeks");
  const plateau = weeks.filter((r) => String(r.as_of_date) < "2018-09-15").at(-1)!;
  const bottom = weeks.reduce((a, b) => (n(b.per_tablet) < n(a.per_tablet) ? b : a));
  const ratio = n(latestBrand.viagra_100mg) / n(cp100.price_per_unit);
  const yearOf = (m: string) => m.slice(0, 4);

  return (
    <section className="act" id="price">
      <header className="act-head">
        <h2>In December 2017, generic Viagra went on sale.</h2>
        <p>
          Draw what you think happened next to the price pharmacies paid for one
          brand-name Viagra tablet.
        </p>
      </header>
      <figure className={`guess ${revealed ? "revealed" : ""}`}>
        {revealed && <p className="guess-title">Same molecule. {int.format(ratio)}× the price.</p>}
        <svg
          viewBox={`0 0 ${GW} ${GH}`}
          role="img"
          aria-label="Price pharmacies paid for one Viagra 100 mg tablet, 2014 to 2026, with the reader's guess"
          onPointerDown={(e) => {
            last.current = null;
            e.currentTarget.setPointerCapture(e.pointerId);
            draw(e);
          }}
          onPointerMove={draw}
        >
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={t} className="grid">
              <line x1={GP.left} x2={GW - GP.right} y1={y(t)} y2={y(t)} />
              <text x={GP.left - 8} y={y(t) + 4} textAnchor="end">${t}</text>
            </g>
          ))}
          {months.map((m, i) =>
            m.endsWith("-01-01") && n(yearOf(m)) % 2 === 0 ? (
              <text key={m} className="tick" x={x(i)} y={GH - 8} textAnchor="middle">{yearOf(m)}</text>
            ) : null,
          )}
          {!revealed && (
            <g className="draw-zone">
              <rect x={x(cut)} y={GP.top} width={x(lastIdx) - x(cut)} height={GH - GP.top - GP.bottom} />
              {drawn === 0 && <text x={(x(cut) + x(lastIdx)) / 2} y={GP.top + 40} textAnchor="middle">Draw the line here</text>}
            </g>
          )}
          <line className="cutoff" x1={x(cut)} x2={x(cut)} y1={GP.top} y2={GH - GP.bottom} />
          <text className="label cutoff-label" x={x(cut) - 6} y={GP.top + 12} textAnchor="end">Generic launches, Dec 2017</text>
          <polyline className="known" style={{ stroke: BLUE }} points={line(months.map((m, i) => (i <= cut ? brandPrice.get(m) : null)))} />
          <polyline className="your-guess" points={line(guess.map((v, i) => (i >= cut ? v : null)))} />
          {revealed && (
            <>
              <polyline className="reveal brand" style={{ stroke: BLUE }} points={line(months.map((m, i) => (i >= cut ? brandPrice.get(m) : null)))} />
              <polyline className="reveal generic" style={{ stroke: OCHRE }} points={line(months.map((m) => genericPrice.get(m)))} />
              <text className="label" x={x(lastIdx) - 4} y={y(n(brandPrice.get(months[lastIdx]))) - 10} textAnchor="end">Viagra</text>
              <text className="label" x={x(lastIdx) - 4} y={y(0) - 10} textAnchor="end">Generic</text>
              <text className="label muted" x={x(firstGeneric) + 8} y={y(n(genericPrice.get(months[firstGeneric]))) - 8}>
                First reported price, {new Date(months[firstGeneric] + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}
              </text>
              {guessAtEnd !== null && (
                <text className="label muted" x={x(lastIdx) - 4} y={y(guessAtEnd) + (Math.abs(guessAtEnd - n(brandPrice.get(months[lastIdx]))) < 8 ? 18 : -10)} textAnchor="end">Your guess</text>
              )}
            </>
          )}
        </svg>
        <div className="guess-controls">
          {!revealed ? (
            <>
              <button className="primary" disabled={!ready} onClick={() => setRevealed(true)}>Show me</button>
              <button onClick={() => setRevealed(true)}>Skip the guess</button>
            </>
          ) : (
            <p>
              {guessAtEnd !== null && <>You drew {usd(guessAtEnd, 0)}. </>}
              It went up: {usd(b2017.viagra_100mg)} in 2017, {usd(b2024.viagra_100mg)} in 2024.
              The generic sat at {usd(plateau.per_tablet, 0)} until September 2018, fell to{" "}
              {usd(bottom.per_tablet)} in five weeks, and kept falling. Cost Plus Drugs sells it
              for {usd(cp100.price_per_unit, 3)}.
            </p>
          )}
        </div>
        <small className="source-line">Medicaid NADAC pharmacy prices; Cost Plus Drugs</small>
      </figure>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------

function ActThree() {
  const fl = (y: number) => pick(miami, "florida_share", { year: y });
  const s = (y: number) => pick(whoPays, "supplemental_share", { plan_year: y });
  const medicaid = (y: number) => {
    const r = pick(whoPays, "medicaid_by_strength", { year: y });
    return n(r.rx_20mg) + n(r.rx_viagra_strengths);
  };
  const medicare = (y: number) => pick(cliff, "national_by_year", { year: y }).claims;
  const change = (f: (y: number) => unknown) => {
    const d = n(f(2024)) / n(f(2017)) - 1;
    return `${d >= 0 ? "+" : "−"}${pct(Math.abs(d))}`;
  };
  const r = (y: number) => pick(miami, "florida_vs_rest", { year: y });
  const max = Math.max(...rows(miami, "florida_vs_rest").map((x) => n(x.fl_claims_per_1000)));
  const legend = "Sildenafil prescriptions (brand and generic) per 1,000 people in Medicare drug plans";
  const maps: MapState[] = [
    { year: 2017, metric: "claims_per_1000", ramp: "ochre", max, legend,
      callout: <><b>{n(r(2017).rest_claims_per_1000).toFixed(1)}</b><span>prescriptions per 1,000 people outside Florida, 2017</span></> },
    { year: 2024, metric: "claims_per_1000", ramp: "ochre", max, legend,
      callout: <><b>{n(r(2024).rest_claims_per_1000).toFixed(1)}</b><span>prescriptions per 1,000 people outside Florida, 2024</span></> },
    { year: 2024, metric: "claims_per_1000", ramp: "ochre", max, legend,
      callout: <><b>{pct(s(2024).covering_share)}</b><span>of Medicare drug plans covered Viagra or its generic in 2024</span></> },
    { year: 2024, metric: "claims_per_1000", ramp: "ochre", max, legend,
      callout: <><b>{change(medicare)} vs. {change(medicaid)}</b><span>Medicare vs. Medicaid sildenafil prescriptions, 2017 to 2024</span></> },
  ];
  const steps: Step[] = [
    { text: <>In 2017, the year the generic arrived, Florida still accounted for {pct(fl(2017).fl_share_of_all_sildenafil)} of Medicare's prescriptions for sildenafil, Viagra's generic name.</>,
      source: "CMS Medicare Part D" },
    { text: <>The rest of the country started to catch up. By 2024, Florida accounted for only {pct(fl(2024).fl_share_of_all_sildenafil)} of Medicare's sildenafil prescriptions, and prescriptions from the rest of the country had grown from {int.format(n(fl(2017).claims_outside_fl))} to {int.format(n(fl(2024).claims_outside_fl))}.</>,
      source: "CMS Medicare Part D" },
    { text: <>In 2019, {pct(s(2019).covering_share, 1)} of Medicare drug plans covered Viagra or its generic as an optional extra. By 2024, {pct(s(2024).covering_share)} did, usually capped at {n(s(2024).typical_tablets_per_30_days)} tablets a month.</>,
      source: "CMS Medicare Part D plan formularies" },
    { text: <>Compare Medicaid, which has the same ban but can't add it as a perk. Its sildenafil prescriptions didn't grow: {int.format(medicaid(2017))} in 2017, {int.format(medicaid(2024))} in 2024. Medicare's went from {int.format(n(medicare(2017)))} to {int.format(n(medicare(2024)))}.</>,
      source: "Medicaid State Drug Utilization Data" },
  ];
  return (
    <section className="act" id="spread">
      <header className="act-head">
        <h2>By 2024, {pct(s(2024).covering_share)} of Medicare drug plans offered Viagra or its generic as an extra.</h2>
      </header>
      <Scrolly steps={steps} graphic={(i) => <StoryMap state={maps[i]} />} />
    </section>
  );
}

function Coda() {
  const partd = pick(cash, "partd_vs_nadac", { year: 2024 });
  const cp100 = rows(cash, "costplus").find((r) => r.strength === "100mg")!;
  return (
    <section className="coda">
      <div>
        <b>{usd(partd.partd_per_claim)}</b>
        <span>Average cost of a generic sildenafil prescription in Medicare, 2024</span>
      </div>
      <div>
        <b>{usd(cp100.total_30_tablets_shipped)}</b>
        <span>Thirty tablets from Cost Plus Drugs, shipped</span>
      </div>
      <small className="source-line">CMS Medicare Part D (before rebates); Cost Plus Drugs</small>
    </section>
  );
}

export function Acts() {
  return (
    <>
      <ActOne />
      <PriceGuess />
      <ActThree />
      <Coda />
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// After the story: the findings that didn't fit the three acts, and one line on the data.

export function AlsoInTheData() {
  const mix = rows(whoPays, "mixture_estimate")[0];
  const f2013 = pick(law, "label_fingerprint", { year: 2013, label: "Viagra" });
  const price2013 = pick(brand, "brand_vs_generic", { year: 2013 });
  const lungHeart2013 = pick(whoPays, "specialty_by_label", { year: 2013, label: "Viagra", specialty_group: "Lung & heart" });
  const ma2019 = pick(miami, "ma_penetration", { year: 2019 });
  const flat = rows(brand, "strength_flat_pricing");
  const partd = pick(cash, "partd_vs_nadac", { year: 2024 });
  const pf = (y: number) => pick(brand, "pfizer_vs_partd", { year: y });
  const mixLo = Math.min(n(mix.viagra_pattern_share_by_specialty), n(mix.viagra_pattern_share_by_age));
  const mixHi = Math.max(n(mix.viagra_pattern_share_by_specialty), n(mix.viagra_pattern_share_by_age));

  const findings = [
    `The average 2013 Viagra prescription in Medicare cost ${usd(f2013.cost_per_claim, 0)}, about ${Math.round(n(f2013.cost_per_claim) / n(price2013.viagra_100mg))} tablets. A month of the pulmonary hypertension dose, the use Medicare does cover, is 90. Only ${pct(lungHeart2013.share)} of those prescriptions came from lung or heart specialists.`,
    "Medicare's basic benefit never covered it. Every formulary that lists the 20 mg pulmonary hypertension tablet requires prior authorization, and no basic formulary lists the 25, 50 or 100 mg strengths.",
    `${pct(ma2019.miami_dade_ma_share)} of Miami-Dade's Medicare beneficiaries were in private Medicare Advantage plans in 2019, against ${pct(ma2019.us_ma_share)} nationally.`,
    `Brand Viagra cost the same per tablet at every strength. In 2014 a 25 mg tablet was ${usd(flat[0].per_tablet_2014)}; a 100 mg tablet was ${usd(flat.at(-1)!.per_tablet_2014)}.`,
    `Pfizer's US Viagra sales fell from $${int.format(n(pf(2016).viagra_us_musd))} million in 2016 to $${int.format(n(pf(2019).viagra_us_musd))} million in 2019.`,
    `Per dose, Medicare's 2024 spending on generic sildenafil was ${usd(partd.partd_per_unit)}, about ${Math.round(n(partd.partd_multiple_of_nadac_20mg))} times what pharmacies paid for a 20 mg tablet.`,
    `CMS stopped separating the two generics in 2019. By prescriber specialty and patient age, ${pct(mixLo)} to ${pct(mixHi)} of 2024's generic prescriptions look like the Viagra-strength product.`,
  ];

  return (
    <section className="work" id="work">
      <h2>Also in the data</h2>
      <ul className="plain-list">
        {findings.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="work-note">
        Data: CMS Medicare Part D, Medicaid, FDA. Every number is computed by
        the queries in <code>sql/</code>.
      </p>
    </section>
  );
}
