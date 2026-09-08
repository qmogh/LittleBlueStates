import { useMemo, useState } from 'react'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import topology from 'us-atlas/states-10m.json'
import snapshot from './data/sildenafil-2024.json'

type MetricKey = 'claims' | 'beneficiaries' | 'prescribers' | 'drugCost'
type BrandKey = 'generic' | 'viagra' | 'revatio'

type Metrics = Record<MetricKey, number> & { fills30Day: number }
type State = Metrics & {
  fips: string
  code: string
  name: string
  brands: Record<BrandKey, Metrics>
}

const states = snapshot.states as State[]
const stateByFips = new Map(states.map((state) => [state.fips, state]))
const usStates = feature(topology as never, topology.objects.states as never) as unknown as GeoJSON.FeatureCollection
const projection = geoAlbersUsa().scale(870).translate([480, 305])
const path = geoPath(projection)

const metricOptions: Record<MetricKey, { label: string; shortLabel: string; format: (value: number) => string }> = {
  claims: { label: 'Claims', shortLabel: 'claims', format: count },
  beneficiaries: { label: 'Beneficiaries', shortLabel: 'beneficiaries', format: count },
  prescribers: { label: 'Prescribers', shortLabel: 'prescribers', format: count },
  drugCost: { label: 'Total drug cost', shortLabel: 'drug cost', format: money },
}

function count(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', notation: value >= 1_000_000 ? 'compact' : 'standard', maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value)
}

function readableBrand(brand: BrandKey) {
  return brand === 'generic' ? 'Generic sildenafil' : brand[0].toUpperCase() + brand.slice(1)
}

function getValue(state: State, metric: MetricKey, brand: BrandKey | 'all') {
  return brand === 'all' ? state[metric] : state.brands[brand][metric]
}

function colorFor(value: number, max: number) {
  if (value === 0) return '#e6e7f6'
  const fraction = Math.sqrt(value / max)
  return `hsl(244 ${48 + fraction * 36}% ${94 - fraction * 50}%)`
}

export default function App() {
  const [metric, setMetric] = useState<MetricKey>('claims')
  const [brand, setBrand] = useState<BrandKey | 'all'>('all')
  const [selectedFips, setSelectedFips] = useState('06')
  const [hoveredFips, setHoveredFips] = useState<string | null>(null)
  const values = useMemo(() => states.map((state) => getValue(state, metric, brand)), [metric, brand])
  const max = Math.max(...values)
  const selected = stateByFips.get(selectedFips) ?? states[0]
  const selectedValue = getValue(selected, metric, brand)
  const selectedRank = 1 + states.filter((state) => getValue(state, metric, brand) > selectedValue).length
  const national = values.reduce((sum, value) => sum + value, 0)
  const leadingState = states.reduce((leader, state) => getValue(state, metric, brand) > getValue(leader, metric, brand) ? state : leader)
  const hovered = hoveredFips ? stateByFips.get(hoveredFips) : undefined

  return <main>
    <header className="masthead"><a className="wordmark" href="#top" aria-label="Little Blue States home">Little Blue States</a><span className="data-tag">Medicare Part D · 2024</span></header>
    <section className="intro" id="top" aria-labelledby="page-title"><p className="eyebrow">A prescription atlas</p><h1 id="page-title">Where does sildenafil show up<br />in Medicare Part D?</h1><p className="deck">Choose a state to explore publicly reported claims, beneficiaries, prescribers, and spending. The little blue pill has a much bigger data story than one brand name.</p></section>
    <section className="controls" aria-label="Map controls">
      <div className="control-group"><span className="control-label">Color the map by</span><div className="segmented" role="group" aria-label="Metric">{(Object.keys(metricOptions) as MetricKey[]).map((key) => <button key={key} className={metric === key ? 'active' : ''} onClick={() => setMetric(key)}>{metricOptions[key].label}</button>)}</div></div>
      <div className="control-group"><span className="control-label">Include</span><div className="segmented" role="group" aria-label="Brand"><button className={brand === 'all' ? 'active' : ''} onClick={() => setBrand('all')}>All sildenafil</button>{(['viagra', 'generic', 'revatio'] as BrandKey[]).map((key) => <button key={key} className={brand === key ? 'active' : ''} onClick={() => setBrand(key)}>{readableBrand(key)}</button>)}</div></div>
    </section>
    <section className="explorer" aria-label="Sildenafil claims explorer">
      <div className="map-wrap"><div className="map-heading"><div><p className="eyebrow">Click a state</p><h2>{metricOptions[metric].label} by state</h2></div><div className="legend" aria-label={`Map legend for ${metricOptions[metric].shortLabel}`}><span>Lower</span><i /><span>Higher</span></div></div>
        <div className="map-frame"><svg viewBox="0 0 960 620" role="img" aria-label={`United States map shaded by ${metricOptions[metric].shortLabel}`}>{usStates.features.map((shape) => {
          const state = stateByFips.get(String(shape.id).padStart(2, '0'))
          if (!state) return null
          const value = getValue(state, metric, brand)
          return <path key={state.fips} d={path(shape) ?? undefined} className={`state ${selected.fips === state.fips ? 'selected' : ''}`} style={{ fill: colorFor(value, max) }} tabIndex={0} role="button" aria-label={`${state.name}: ${metricOptions[metric].format(value)}`} onClick={() => setSelectedFips(state.fips)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedFips(state.fips) } }} onMouseEnter={() => setHoveredFips(state.fips)} onMouseLeave={() => setHoveredFips(null)} onFocus={() => setHoveredFips(state.fips)} onBlur={() => setHoveredFips(null)} />
        })}</svg>{hovered && hovered.fips !== selected.fips && <div className="tooltip"><strong>{hovered.name}</strong>{metricOptions[metric].format(getValue(hovered, metric, brand))}</div>}</div>
      </div>
      <aside className="detail-panel" aria-live="polite"><p className="eyebrow">State profile</p><div className="state-name"><span>{selected.code}</span><h2>{selected.name}</h2></div><div className="hero-stat"><strong>{metricOptions[metric].format(selectedValue)}</strong><span>{metricOptions[metric].shortLabel} · {brand === 'all' ? 'all sildenafil' : readableBrand(brand)}</span></div><div className="rank">Ranks <strong>#{selectedRank}</strong> of {states.length} states and territories</div><div className="brand-breakdown"><h3>Claim mix</h3>{(['generic', 'viagra', 'revatio'] as BrandKey[]).map((key) => { const claims = selected.brands[key].claims; const share = selected.claims ? (claims / selected.claims) * 100 : 0; return <div className="brand-row" key={key}><span>{readableBrand(key)}</span><strong>{count(claims)}</strong><div className="bar"><i style={{ width: `${share}%` }} /></div><em>{share.toFixed(1)}%</em></div> })}</div><p className="panel-note">Claims include original prescriptions and refills. A future release will add per-capita comparisons and year-over-year change.</p></aside>
    </section>
    <section className="takeaway" aria-label="National snapshot"><div><p className="eyebrow">The national picture</p><h2>{metricOptions[metric].format(national)}</h2><p>{metricOptions[metric].shortLabel} across states and territories in this view.</p></div><div><p className="eyebrow">Highest total</p><h2>{leadingState.name}</h2><p>{metricOptions[metric].format(getValue(leadingState, metric, brand))} {metricOptions[metric].shortLabel}.</p></div></section>
    <footer><p><strong>What this is:</strong> publicly reported 2024 Medicare Part D data for records with the generic name Sildenafil Citrate.</p><p><strong>What it isn’t:</strong> a count of every U.S. prescription, a diagnosis map, or proof that every sildenafil claim is for Viagra or erectile dysfunction.</p><a href={snapshot.metadata.sourceUrl} target="_blank" rel="noreferrer">View the CMS source data ↗</a></footer>
  </main>
}
