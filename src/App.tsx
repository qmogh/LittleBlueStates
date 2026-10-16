import { useRef, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import topology from "us-atlas/states-10m.json";
import snapshot from "./data/sildenafil-2024.json";
import providerCityCoordinates from "./data/provider-city-coordinates-2024.json";
import providerFootprint from "./data/provider-footprint-2024.json";
import providerFootprintHistory from "./data/provider-footprint-history.json";

type BrandKey = "generic" | "viagra" | "revatio";
type ViewKey = "genericShare" | "claims" | "costPerClaim" | "seniorShare";
type State = {
  fips: string;
  code: string;
  name: string;
  claims: number;
  fills30Day: number;
  drugCost: number;
  age65Plus: { claims: number };
  brands: Record<BrandKey, { claims: number }>;
};
type YearData = { year: number; states: State[] };
type ProviderAggregate = {
  claims: number;
  providers: number;
};
type ProviderState = {
  code: string;
  cities: Array<ProviderAggregate & { city: string }>;
  specialties: Array<ProviderAggregate & { specialty: string }>;
};
type ProviderCityPoint = {
  year: number;
  state: string;
  city: string;
  latitude: number;
  longitude: number;
};
type ProviderYear = { year: number; states: ProviderState[] };
type MapView = { scale: number; x: number; y: number };

const yearly = snapshot.yearly as YearData[];
const years = yearly.map(({ year }) => year);
const providerStates = new Map(
  (providerFootprint.states as ProviderState[]).map((state) => [
    state.code,
    state,
  ]),
);
const providerStatesByYear = new Map<number, Map<string, ProviderState>>([
  [2024, providerStates],
  ...(providerFootprintHistory.yearly as ProviderYear[]).map(
    (entry): [number, Map<string, ProviderState>] => [
      entry.year,
      new Map(entry.states.map((state) => [state.code, state])),
    ],
  ),
]);
const cityPointByKey = new Map(
  (providerCityCoordinates.cities as ProviderCityPoint[]).map((city) => [
    `${city.year}:${city.state}:${city.city}`,
    city,
  ]),
);
const topologyStates = feature(
  topology as never,
  topology.objects.states as never,
) as unknown as GeoJSON.FeatureCollection;
const projection = geoAlbersUsa().scale(870).translate([480, 305]);
const path = geoPath(projection);
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});
const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const defaultMapView: MapView = { scale: 1, x: 0, y: 0 };

const viewLabels: Record<ViewKey, string> = {
  genericShare: "Generic takeover",
  claims: "All sildenafil claims",
  costPerClaim: "Cost per claim",
  seniorShare: "65+ claim share",
};

function share(state: State, brand: BrandKey) {
  return state.claims ? state.brands[brand].claims / state.claims : 0;
}
function seniorShare(state: State) {
  return state.claims ? state.age65Plus.claims / state.claims : 0;
}
function costPerClaim(state: State) {
  return state.claims ? state.drugCost / state.claims : 0;
}
function formatValue(value: number, view: ViewKey) {
  return view === "genericShare" || view === "seniorShare"
    ? percent.format(value)
    : view === "costPerClaim"
      ? dollars.format(value)
      : number.format(value);
}
function valueFor(state: State, view: ViewKey) {
  return view === "genericShare"
    ? share(state, "generic")
    : view === "seniorShare"
      ? seniorShare(state)
      : view === "costPerClaim"
        ? costPerClaim(state)
        : state.claims;
}
function fillFor(value: number, max: number, view: ViewKey) {
  if (view === "genericShare")
    return `hsl(${221 - value * 182} 52% ${42 + value * 38}%)`;
  if (view === "seniorShare")
    return `hsl(${183 - value * 55} 42% ${88 - value * 36}%)`;
  const t = Math.sqrt(value / max);
  return `hsl(248 ${30 + t * 47}% ${95 - t * 53}%)`;
}
function nationalShare(states: State[], brand: BrandKey) {
  const claims = states.reduce((sum, state) => sum + state.claims, 0);
  return (
    states.reduce((sum, state) => sum + state.brands[brand].claims, 0) / claims
  );
}

function TrendChart({ stateSeries }: { stateSeries: State[] }) {
  const width = 285;
  const height = 115;
  const pad = { top: 11, right: 4, bottom: 19, left: 2 };
  const x = (index: number) =>
    pad.left +
    index * ((width - pad.left - pad.right) / (stateSeries.length - 1));
  const y = (value: number) =>
    height - pad.bottom - value * (height - pad.top - pad.bottom);
  const points = stateSeries
    .map((state, index) => `${x(index)},${y(share(state, "generic"))}`)
    .join(" ");
  const nationalPoints = yearly
    .map(
      ({ states }, index) =>
        `${x(index)},${y(nationalShare(states, "generic"))}`,
    )
    .join(" ");
  return (
    <div className="trend">
      <div className="chart-label">
        <span>
          <i className="state-dot" />
          This state
        </span>
        <span>
          <i className="nation-dot" />
          All states
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        aria-label="Generic sildenafil share over time"
      >
        <line
          x1="0"
          x2={width}
          y1={y(0.5)}
          y2={y(0.5)}
          className="chart-guide"
        />
        <text x="2" y={y(0.5) - 4}>
          50% generic
        </text>
        <polyline points={nationalPoints} className="national-line" />
        <polyline points={points} className="state-line" />
        {stateSeries.map((_, index) => (
          <text
            key={years[index]}
            x={x(index)}
            y={height - 2}
            textAnchor={
              index === 0
                ? "start"
                : index === stateSeries.length - 1
                  ? "end"
                  : "middle"
            }
          >
            {index === 0 || index === stateSeries.length - 1
              ? years[index]
              : ""}
          </text>
        ))}
      </svg>
    </div>
  );
}

function ProviderFootprint({
  code,
  year,
  activeCity,
  onCitySelect,
}: {
  code: string;
  year: number;
  activeCity: string | null;
  onCitySelect: (city: string) => void;
}) {
  const footprint = providerStatesByYear.get(year)?.get(code);
  if (!footprint) return null;
  const cities = footprint.cities.slice(0, 5);
  const specialties = footprint.specialties.slice(0, 4);
  const cityMax = cities[0]?.claims ?? 1;

  return (
    <section className="provider-footprint">
      <div className="provider-footprint-heading">
        <span>{year} practice locations</span>
        <small>Not patient locations</small>
      </div>
      <div className="city-list">
        {cities.map((city) => (
          <button
            key={city.city}
            className={city.city === activeCity ? "active" : ""}
            onClick={() => onCitySelect(city.city)}
            aria-pressed={city.city === activeCity}
          >
            <span className="city-dot" />
            <span className="city-name">{city.city}</span>
            <i>
              <b style={{ width: `${(city.claims / cityMax) * 100}%` }} />
            </i>
            <strong>{number.format(city.claims)}</strong>
          </button>
        ))}
      </div>
      {activeCity && (
        <p className="city-detail">
          {activeCity} ·{" "}
          {number.format(
            cities.find((city) => city.city === activeCity)?.claims ?? 0,
          )}{" "}
          reported claims ·{" "}
          {number.format(
            cities.find((city) => city.city === activeCity)?.providers ?? 0,
          )}{" "}
          providers
        </p>
      )}
      <div className="specialty-list">
        {specialties.map((specialty) => (
          <span key={specialty.specialty}>
            {specialty.specialty} <b>{number.format(specialty.claims)}</b>
          </span>
        ))}
      </div>
    </section>
  );
}

function ProviderCityDots({
  code,
  year,
  zoom,
  activeCity,
  onCitySelect,
}: {
  code: string;
  year: number;
  zoom: number;
  activeCity: string | null;
  onCitySelect: (city: string) => void;
}) {
  const cities =
    providerStatesByYear.get(year)?.get(code)?.cities.slice(0, 5) ?? [];
  const cityMax = cities[0]?.claims ?? 1;

  return (
    <g
      className="practice-dots"
      aria-label="Reported prescriber practice cities"
    >
      {cities.map((city) => {
        const cityPoint = cityPointByKey.get(`${year}:${code}:${city.city}`);
        const point = cityPoint
          ? projection([cityPoint.longitude, cityPoint.latitude])
          : null;
        if (!point) return null;
        return (
          <circle
            key={city.city}
            cx={point[0]}
            cy={point[1]}
            r={(2.5 + 3.5 * Math.sqrt(city.claims / cityMax)) / zoom}
            className={
              city.city === activeCity ? "practice-dot active" : "practice-dot"
            }
            vectorEffect="non-scaling-stroke"
            role="button"
            tabIndex={0}
            aria-label={`${city.city}: ${number.format(city.claims)} reported claims from ${number.format(city.providers)} providers`}
            onClick={(event) => {
              event.stopPropagation();
              onCitySelect(city.city);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onCitySelect(city.city);
              }
            }}
          >
            <title>{`${city.city}: ${number.format(city.claims)} reported claims`}</title>
          </circle>
        );
      })}
    </g>
  );
}

export default function App() {
  const [year, setYear] = useState(2024);
  const [view, setView] = useState<ViewKey>("genericShare");
  const [selectedFips, setSelectedFips] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [manualMapView, setManualMapView] = useState<MapView>(defaultMapView);
  const manualMapViewRef = useRef(manualMapView);
  const touchPoints = useRef(new Map<number, { x: number; y: number }>());
  const touchGesture = useRef<{
    center: { x: number; y: number };
    distance: number;
    view: MapView;
  } | null>(null);
  const [hoveredFips, setHoveredFips] = useState<string | null>(null);
  const current = yearly.find((item) => item.year === year) ?? yearly.at(-1)!;
  const byFips = new Map(current.states.map((state) => [state.fips, state]));
  const selected = selectedFips ? byFips.get(selectedFips) : undefined;
  const selectedSeries = selected
    ? yearly
        .map(
          ({ states }) => states.find((state) => state.fips === selected.fips)!,
        )
        .filter(Boolean)
    : [];
  const max = Math.max(...current.states.map((state) => valueFor(state, view)));
  const nationalGeneric = nationalShare(current.states, "generic");
  const nationalViagra = nationalShare(current.states, "viagra");
  const hovered = hoveredFips ? byFips.get(hoveredFips) : undefined;
  const crossover = selectedSeries.findIndex(
    (state) => share(state, "generic") >= 0.5,
  );
  const rank = selected
    ? 1 +
      current.states.filter(
        (state) => valueFor(state, view) > valueFor(selected, view),
      ).length
    : 0;
  const claimIntensity = selected?.claims
    ? selected.fills30Day / selected.claims
    : 0;
  const nationalClaims = current.states.reduce(
    (sum, state) => sum + state.claims,
    0,
  );
  const nationalSeniorShare =
    current.states.reduce((sum, state) => sum + state.age65Plus.claims, 0) /
    nationalClaims;
  const nationalCostPerClaim =
    current.states.reduce((sum, state) => sum + state.drugCost, 0) /
    nationalClaims;
  const selectedShape = selected
    ? topologyStates.features.find(
        (shape) => String(shape.id).padStart(2, "0") === selected.fips,
      )
    : undefined;
  const [centerX, centerY] = selectedShape
    ? path.centroid(selectedShape)
    : [480, 310];
  const [[minX, minY], [maxX, maxY]] = selectedShape
    ? path.bounds(selectedShape)
    : [
        [0, 0],
        [960, 620],
      ];
  const zoom = selectedShape
    ? Math.min(
        9,
        Math.max(1.65, Math.min(650 / (maxX - minX), 470 / (maxY - minY))),
      )
    : 1;
  const mapTransform = selectedShape
    ? `translate(480 310) scale(${zoom}) translate(${-centerX} ${-centerY})`
    : "translate(0 0) scale(1)";
  const minManualMapScale = selectedShape ? 1 / zoom : 1;
  const zoomProgress = selectedShape
    ? (manualMapView.scale - minManualMapScale) / (1 - minManualMapScale)
    : 1;
  const autoMapOffset = selectedShape
    ? { x: 480 - zoom * centerX, y: 310 - zoom * centerY }
    : { x: 0, y: 0 };
  const manualMapOffset = {
    x:
      manualMapView.x -
      (1 - zoomProgress) * manualMapView.scale * autoMapOffset.x,
    y:
      manualMapView.y -
      (1 - zoomProgress) * manualMapView.scale * autoMapOffset.y,
  };
  const updateMapView = (next: MapView) => {
    manualMapViewRef.current = next;
    setManualMapView(next);
  };
  const mapPoint = (event: {
    clientX: number;
    clientY: number;
    currentTarget: SVGSVGElement;
  }) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * 960,
      y: ((event.clientY - bounds.top) / bounds.height) * 620,
    };
  };
  const zoomMapAt = (point: { x: number; y: number }, factor: number) => {
    const currentView = manualMapViewRef.current;
    const scale = Math.min(
      5,
      Math.max(minManualMapScale, currentView.scale * factor),
    );
    if (selectedShape && factor < 1 && scale <= minManualMapScale + 0.001) {
      setSelectedFips(null);
      setSelectedCity(null);
      resetMapView();
      return;
    }
    const ratio = scale / currentView.scale;
    updateMapView({
      scale,
      x: point.x - ratio * (point.x - currentView.x),
      y: point.y - ratio * (point.y - currentView.y),
    });
  };
  const resetMapView = () => updateMapView(defaultMapView);
  const twoTouchPoints = () => [...touchPoints.current.values()].slice(0, 2);
  const heroCopy =
    year === 2013
      ? "In 2013, the map was very, very blue."
      : year === 2024
        ? "In 2024, nearly every blue pill in this dataset had gone generic."
        : `By ${year}, the color change was underway.`;

  return (
    <main>
      <header className="masthead">
        <a href="#top" className="wordmark">
          Little Blue States
        </a>
        <span>PUBLIC DATA, PRIVATE JOKES</span>
      </header>
      <section id="top" className="hero">
        <h1>
          The little blue pill
          <br />
          <em>went beige.</em>
        </h1>
        <p className="dek">
          For a decade, brand-name Viagra drained out of Medicare Part D data,
          state by state. What replaced it tells a bigger story about a
          blockbuster drug becoming a commodity.
        </p>
        <div className="before-after">
          <div>
            <span>2013</span>
            <strong>78.4%</strong>
            <p>of sildenafil claims were Viagra</p>
          </div>
          <div className="arrow">→</div>
          <div>
            <span>2024</span>
            <strong>0.05%</strong>
            <p>of sildenafil claims were Viagra</p>
          </div>
        </div>
      </section>
      <section className="switchboard" aria-label="State map explorer">
        <div className="switch-header">
          <h2>{heroCopy}</h2>
        </div>
        <div className="year-control">
          <button
            onClick={() => setYear((value) => Math.max(years[0], value - 1))}
            disabled={year === years[0]}
            aria-label="Previous year"
          >
            ←
          </button>
          <input
            type="range"
            min={years[0]}
            max={years.at(-1)}
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            aria-label="Data year"
          />
          <button
            onClick={() =>
              setYear((value) => Math.min(years.at(-1)!, value + 1))
            }
            disabled={year === years.at(-1)}
            aria-label="Next year"
          >
            →
          </button>
          <strong>{year}</strong>
        </div>
        <div className="view-picker" role="group" aria-label="Map view">
          {(Object.keys(viewLabels) as ViewKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={key === view ? "active" : ""}
            >
              {viewLabels[key]}
            </button>
          ))}
        </div>
        <div className="explorer">
          <div className="map-wrap">
            <div className="map-title">
              <span>{viewLabels[view]}</span>
              <small>Darker = more</small>
            </div>
            <div className="map-frame">
              <div className="map-controls" aria-label="Map controls">
                <button
                  onClick={() => zoomMapAt({ x: 480, y: 310 }, 1.25)}
                  aria-label="Zoom in"
                >
                  +
                </button>
                <button
                  onClick={() => zoomMapAt({ x: 480, y: 310 }, 0.8)}
                  aria-label="Zoom out"
                >
                  −
                </button>
                <button onClick={resetMapView} aria-label="Reset map view">
                  ↺
                </button>
              </div>
              <svg
                viewBox="0 0 960 620"
                role="application"
                aria-label={`United States map showing ${viewLabels[view]} in ${year}`}
                onWheel={(event) => {
                  event.preventDefault();
                  const point = mapPoint(event);
                  if (event.ctrlKey) {
                    zoomMapAt(point, Math.exp(-event.deltaY * 0.01));
                    return;
                  }
                  const currentView = manualMapViewRef.current;
                  updateMapView({
                    ...currentView,
                    x: currentView.x - event.deltaX,
                    y: currentView.y - event.deltaY,
                  });
                }}
                onPointerDown={(event) => {
                  if (event.pointerType !== "touch") return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  touchPoints.current.set(event.pointerId, mapPoint(event));
                  if (touchPoints.current.size === 2) {
                    const [first, second] = twoTouchPoints();
                    touchGesture.current = {
                      center: {
                        x: (first.x + second.x) / 2,
                        y: (first.y + second.y) / 2,
                      },
                      distance: Math.hypot(
                        first.x - second.x,
                        first.y - second.y,
                      ),
                      view: manualMapViewRef.current,
                    };
                  }
                }}
                onPointerMove={(event) => {
                  if (!touchPoints.current.has(event.pointerId)) return;
                  touchPoints.current.set(event.pointerId, mapPoint(event));
                  const gesture = touchGesture.current;
                  if (!gesture || touchPoints.current.size !== 2) return;
                  event.preventDefault();
                  const [first, second] = twoTouchPoints();
                  const center = {
                    x: (first.x + second.x) / 2,
                    y: (first.y + second.y) / 2,
                  };
                  const scale = Math.min(
                    5,
                    Math.max(
                      minManualMapScale,
                      gesture.view.scale *
                        (Math.hypot(first.x - second.x, first.y - second.y) /
                          gesture.distance),
                    ),
                  );
                  if (scale <= minManualMapScale + 0.001) {
                    setSelectedFips(null);
                    setSelectedCity(null);
                    resetMapView();
                    return;
                  }
                  const ratio = scale / gesture.view.scale;
                  updateMapView({
                    scale,
                    x: center.x - ratio * (gesture.center.x - gesture.view.x),
                    y: center.y - ratio * (gesture.center.y - gesture.view.y),
                  });
                }}
                onPointerUp={(event) => {
                  touchPoints.current.delete(event.pointerId);
                  touchGesture.current = null;
                }}
                onPointerCancel={(event) => {
                  touchPoints.current.delete(event.pointerId);
                  touchGesture.current = null;
                }}
                onClick={() => {
                  setSelectedFips(null);
                  setSelectedCity(null);
                  resetMapView();
                }}
              >
                <g
                  className="manual-map-layer"
                  transform={`translate(${manualMapOffset.x} ${manualMapOffset.y}) scale(${manualMapView.scale})`}
                >
                  <g className="map-layer" transform={mapTransform}>
                    {topologyStates.features.map((shape) => {
                      const state = byFips.get(
                        String(shape.id).padStart(2, "0"),
                      );
                      if (!state) return null;
                      const value = valueFor(state, view);
                      return (
                        <path
                          key={state.fips}
                          d={path(shape) ?? undefined}
                          className={`state ${state.fips === selected?.fips ? "selected" : ""}`}
                          style={{ fill: fillFor(value, max, view) }}
                          tabIndex={0}
                          role="button"
                          aria-label={`${state.name}: ${formatValue(value, view)}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedFips(state.fips);
                            setSelectedCity(null);
                            resetMapView();
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedFips(state.fips);
                              setSelectedCity(null);
                              resetMapView();
                            }
                          }}
                          onMouseEnter={() => setHoveredFips(state.fips)}
                          onMouseLeave={() => setHoveredFips(null)}
                          onFocus={() => setHoveredFips(state.fips)}
                          onBlur={() => setHoveredFips(null)}
                        />
                      );
                    })}
                    {selected && (
                      <ProviderCityDots
                        code={selected.code}
                        year={year}
                        zoom={zoom * manualMapView.scale}
                        activeCity={selectedCity}
                        onCitySelect={setSelectedCity}
                      />
                    )}
                  </g>
                </g>
              </svg>
              {hovered && hovered.fips !== selected?.fips && (
                <div className="tooltip">
                  <strong>{hovered.name}</strong>
                  {formatValue(valueFor(hovered, view), view)}
                </div>
              )}
            </div>
          </div>
          {selected ? (
            <aside className="receipt" key={`${selected.fips}-${year}`}>
              <p className="receipt-label">STATE RECEIPT · {year}</p>
              <div className="state-heading">
                <span>{selected.code}</span>
                <h2>{selected.name}</h2>
              </div>
              <p className="receipt-lede">
                {crossover >= 0 ? (
                  <>
                    Went majority generic in <strong>{years[crossover]}</strong>
                    .
                  </>
                ) : (
                  "Never reached a majority-generic share in the reported years."
                )}{" "}
                In {year}, its Viagra share was{" "}
                <strong>{percent.format(share(selected, "viagra"))}</strong>.
              </p>
              <TrendChart stateSeries={selectedSeries} />
              <div className="stat-grid">
                <div>
                  <span>Claims</span>
                  <strong>{number.format(selected.claims)}</strong>
                </div>
                <div>
                  <span>65+ share</span>
                  <strong>{percent.format(seniorShare(selected))}</strong>
                </div>
                <div>
                  <span>Cost / claim</span>
                  <strong>{dollars.format(costPerClaim(selected))}</strong>
                </div>
                <div>
                  <span>30-day fills / claim</span>
                  <strong>{claimIntensity.toFixed(1)}</strong>
                </div>
              </div>
              <div className="brand-mix">
                <span>Brand mix</span>
                {(["generic", "viagra", "revatio"] as BrandKey[]).map(
                  (brand) => (
                    <div key={brand}>
                      <label>
                        {brand === "generic"
                          ? "Generic sildenafil"
                          : brand[0].toUpperCase() + brand.slice(1)}
                      </label>
                      <i>
                        <b
                          style={{ width: `${share(selected, brand) * 100}%` }}
                        />
                      </i>
                      <strong>{percent.format(share(selected, brand))}</strong>
                    </div>
                  ),
                )}
              </div>
              <ProviderFootprint
                code={selected.code}
                year={year}
                activeCity={selectedCity}
                onCitySelect={setSelectedCity}
              />
              <p className="rank-note">
                Ranks #{rank} of {current.states.length} states and territories
                for {viewLabels[view].toLowerCase()}.
              </p>
            </aside>
          ) : (
            <aside className="receipt federal-receipt" key={`federal-${year}`}>
              <p className="receipt-label">FEDERAL VIEW · {year}</p>
              <div className="state-heading">
                <span>US</span>
                <h2>United States</h2>
              </div>
              <div className="stat-grid">
                <div>
                  <span>Claims</span>
                  <strong>{number.format(nationalClaims)}</strong>
                </div>
                <div>
                  <span>Generic share</span>
                  <strong>{percent.format(nationalGeneric)}</strong>
                </div>
                <div>
                  <span>65+ share</span>
                  <strong>{percent.format(nationalSeniorShare)}</strong>
                </div>
                <div>
                  <span>Cost / claim</span>
                  <strong>{dollars.format(nationalCostPerClaim)}</strong>
                </div>
              </div>
              <div className="brand-mix">
                <span>Brand mix</span>
                {(["generic", "viagra", "revatio"] as BrandKey[]).map(
                  (brand) => (
                    <div key={brand}>
                      <label>
                        {brand === "generic"
                          ? "Generic sildenafil"
                          : brand[0].toUpperCase() + brand.slice(1)}
                      </label>
                      <i>
                        <b
                          style={{
                            width: `${nationalShare(current.states, brand) * 100}%`,
                          }}
                        />
                      </i>
                      <strong>
                        {percent.format(nationalShare(current.states, brand))}
                      </strong>
                    </div>
                  ),
                )}
              </div>
              <p className="rank-note">
                The source groups claims by prescriber geography—not by a
                patient's home address.
              </p>
            </aside>
          )}
        </div>
      </section>
      <section className="national">
        <div>
          <p className="kicker">The {year} readout</p>
          <h2>
            {number.format(
              current.states.reduce((sum, state) => sum + state.claims, 0),
            )}
          </h2>
          <p>reported sildenafil claims in this state-and-territory view.</p>
        </div>
        <div>
          <p className="kicker">Trademark sightings</p>
          <h2>{percent.format(nationalViagra)}</h2>
          <p>
            were brand-name Viagra, compared with{" "}
            {percent.format(nationalGeneric)} generic sildenafil.
          </p>
        </div>
        <div>
          <p className="kicker">Read the fine print</p>
          <p>
            This is not a map of sex, diagnoses, or every U.S. prescription. It
            is Medicare Part D claims under the generic name Sildenafil
            Citrate—and claims include refills.
          </p>
        </div>
      </section>
      <footer>
        <p>
          Source: Centers for Medicare &amp; Medicaid Services,{" "}
          <a
            href="https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers/medicare-part-d-prescribers-by-geography-and-drug"
            target="_blank"
            rel="noreferrer"
          >
            Medicare Part D Prescribers — by Geography and Drug
          </a>
          . Counts below 11 may be suppressed in source fields; 65+ metrics use
          reported, non-suppressed values.
        </p>
        <p>
          Sildenafil is not synonymous with Viagra and has uses beyond erectile
          dysfunction. Supposedly.
        </p>
      </footer>
    </main>
  );
}
