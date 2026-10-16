import type { ReactNode } from "react";
import law from "./data/story/01-law.json";
import miami from "./data/story/02-miami.json";
import cliff from "./data/story/03-patent-cliff.json";
import brand from "./data/story/04-brand-price.json";
import whoPays from "./data/story/05-who-pays.json";
import cash from "./data/story/06-cash.json";
import checks from "./data/story/07-checks.json";
import {
  BRAND,
  CONTEXT,
  ColumnChart,
  DataTable,
  DotPlot,
  GENERIC,
  LineChart,
} from "./charts";

// Every number in the copy is read from src/data/story/*.json (built by `npm run data:story`
// from sql/*.sql), and every sentence carries a numbered source.

type Row = Record<string, number | string | boolean | null>;
type Source = { text: string; query?: string; url?: string };

function rows(file: { outputs: Record<string, unknown> }, key: string) {
  return file.outputs[key] as Row[];
}
function pick(file: { outputs: Record<string, unknown> }, key: string, where: Row = {}) {
  const found = rows(file, key).find((row) =>
    Object.entries(where).every(([k, v]) => row[k] === v),
  );
  if (!found) throw new Error(`No ${key} row matching ${JSON.stringify(where)}`);
  return found;
}
const n = (value: unknown) => Number(value);

const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pct = (value: unknown, digits = 0) =>
  `${(n(value) * 100).toFixed(digits)}%`;
const usd = (value: unknown, digits = 2) =>
  `$${n(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const millions = (value: unknown) => `$${(n(value) / 1e6).toFixed(1)} million`;
const year = (value: number) => String(Math.round(value));

const CMS_GEO =
  "https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers/medicare-part-d-prescribers-by-geography-and-drug";
const CMS_PROVIDER =
  "https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers/medicare-part-d-prescribers-by-provider-and-drug";
const CMS_FORMULARY =
  "https://data.cms.gov/provider-characteristics/medicare-provider-supplier-enrollment/quarterly-prescription-drug-plan-formulary-pharmacy-network-and-pricing-information";
const NADAC = "https://data.medicaid.gov/nadac";
const LAW = "https://www.govinfo.gov/content/pkg/PLAW-109publ91/html/PLAW-109publ91.htm";

function Cite({ section, n: index }: { section: string; n: number | number[] }) {
  const list = Array.isArray(index) ? index : [index];
  return (
    <sup className="cite">
      {list.map((i, k) => (
        <span key={i}>
          {k > 0 && ","}
          <a href={`#src-${section}-${i}`}>{i}</a>
        </span>
      ))}
    </sup>
  );
}

function Sources({ section, sources }: { section: string; sources: Source[] }) {
  return (
    <ol className="sources">
      {sources.map((source, i) => (
        <li key={i} id={`src-${section}-${i + 1}`}>
          {source.url ? (
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.text}
            </a>
          ) : (
            source.text
          )}
          {source.query && <code>{source.query}</code>}
        </li>
      ))}
    </ol>
  );
}

function Chapter({
  id,
  number,
  title,
  children,
  figure,
  sources,
}: {
  id: string;
  number: string;
  title: string;
  children: ReactNode;
  figure: ReactNode;
  sources: Source[];
}) {
  return (
    <section className="chapter" id={id}>
      <div className="chapter-text">
        <p className="kicker">{number}</p>
        <h2>{title}</h2>
        {children}
      </div>
      <div className="chapter-figure">
        {figure}
        <Sources section={id} sources={sources} />
      </div>
    </section>
  );
}

export function StoryHero() {
  const v2013 = pick(law, "viagra_by_year", { year: 2013 });
  return (
    <section id="top" className="hero">
      <p className="kicker">A Medicare data story</p>
      <h1>
        Medicare doesn't
        <br />
        <em>pay for Viagra.</em>
      </h1>
      <p className="dek">
        Federal law has said so since January 1, 2007. Medicare's own records
        show {int.format(n(v2013.claims))} Viagra claims in 2013 anyway. This is
        where they came from, what happened when the patent ran out, and who
        pays now.
      </p>
    </section>
  );
}

function LawChapter() {
  const id = "law";
  const v2013 = pick(law, "viagra_by_year", { year: 2013 });
  const f2013 = pick(law, "label_fingerprint", { year: 2013, label: "Viagra" });
  const price2013 = pick(brand, "brand_vs_generic", { year: 2013 });
  const lungHeart2013 = pick(whoPays, "specialty_by_label", {
    year: 2013,
    label: "Viagra",
    specialty_group: "Lung & heart",
  });
  const tablets = n(f2013.cost_per_claim) / n(price2013.viagra_100mg);
  const series = rows(law, "viagra_by_year");
  return (
    <Chapter
      id={id}
      number="01 · The rule"
      title="The law says no. The ledger says otherwise."
      figure={
        <>
          <p className="figure-title">Brand-name Viagra claims in Medicare Part D</p>
          <ColumnChart
            data={series.map((r) => ({ x: n(r.year), y: n(r.claims) }))}
            color={BRAND}
            formatY={(v) => int.format(v)}
            highlight={2013}
            label="Brand-name Viagra claims in Medicare Part D by year, 2013 to 2024"
          />
          <DataTable
            columns={["Year", "Claims", "People", "Cost per claim"]}
            rows={series.map((r) => [r.year, int.format(n(r.claims)), int.format(n(r.benes)), usd(r.cost_per_claim)])}
          />
        </>
      }
      sources={[
        { text: "Pub. L. 109-91 §103(a)(2), (c): Part D excludes drugs used for sexual or erectile dysfunction, effective Jan 1, 2007", url: LAW },
        { text: "Pub. L. 109-91 §103(b); 42 CFR 423.104(f)(1)(ii)(A): plans may cover excluded drugs as supplemental benefits", url: "https://www.ecfr.gov/current/title-42/part-423/section-423.104" },
        { text: "CMS Part D Prescribers by Geography and Drug, national, Viagra, 2013", query: "sql/01-law.sql → viagra_by_year (year 2013)", url: CMS_GEO },
        { text: "NADAC, Viagra 100 mg tablet, 2013 mean", query: "sql/04-brand-price.sql → brand_vs_generic (year 2013)", url: NADAC },
        { text: "FDA label, Revatio: 20 mg three times a day", url: "https://api.fda.gov/drug/label.json?search=openfda.brand_name:REVATIO" },
        { text: "CMS Part D Prescribers by Geography and Drug, national, 2013, by label", query: "sql/01-law.sql → label_fingerprint (2013, Viagra)", url: CMS_GEO },
        { text: "CMS Part D Prescribers by Provider and Drug, 2013 (rows with 11+ claims)", query: "sql/05-who-pays.sql → specialty_by_label (2013, Viagra)", url: CMS_PROVIDER },
      ]}
    >
      <p>
        Since 2007, Medicare's drug benefit has excluded drugs "when used for
        the treatment of sexual or erectile dysfunction."
        <Cite section={id} n={1} /> The same law lets private plans cover those
        drugs anyway, as an optional extra outside the basic benefit.
        <Cite section={id} n={2} />
      </p>
      <p>
        In 2013, Medicare recorded {int.format(n(v2013.claims))} Viagra claims
        for {int.format(n(v2013.benes))} people.
        <Cite section={id} n={3} /> The average claim cost{" "}
        {usd(v2013.cost_per_claim, 0)}. At the 2013 pharmacy price of{" "}
        {usd(price2013.viagra_100mg)} a tablet, that is about{" "}
        {Math.round(tablets)} tablets.
        <Cite section={id} n={4} /> A month of the pulmonary hypertension dose,
        the one use Medicare does cover, is 90.
        <Cite section={id} n={5} />
      </p>
      <p>
        {pct(f2013.share_65_plus)} of those claims were for people 65 or older.
        <Cite section={id} n={6} /> {pct(lungHeart2013.share)} were written by
        lung or heart specialists, who treat pulmonary hypertension.
        <Cite section={id} n={7} />
      </p>
    </Chapter>
  );
}

function MiamiChapter() {
  const id = "miami";
  const fl = rows(miami, "florida_share");
  const peak = fl.reduce((a, b) => (n(b.fl_share_of_viagra) > n(a.fl_share_of_viagra) ? b : a));
  const mh = rows(miami, "miami_share");
  const mhPeak = mh.filter((r) => n(r.year) <= 2018);
  const mhLow = Math.min(...mhPeak.map((r) => n(r.miami_hialeah_share)));
  const mhHigh = Math.max(...mhPeak.map((r) => n(r.miami_hialeah_share)));
  const concentration = rows(miami, "prescriber_concentration").filter((r) => n(r.year) <= 2018);
  const maxTop10 = Math.max(...concentration.map((r) => n(r.top10_share)));
  const minPrescribers = Math.min(...concentration.map((r) => n(r.prescribers)));
  const cov2019 = (area: string) => pick(miami, "plan_coverage", { plan_year: 2019, area });
  const ma2019 = pick(miami, "ma_penetration", { year: 2019 });
  return (
    <Chapter
      id={id}
      number="02 · The exception"
      title="For a decade, it was mostly Miami."
      figure={
        <>
          <p className="figure-title">Florida's share of Medicare…</p>
          <p className="figure-note">Brand-name Viagra, 2013–2019. After 2019 the brand all but disappears from Part D.</p>
          <LineChart
            label="Florida's share of Medicare Viagra claims versus its share of Part D enrollees, 2013 to 2024"
            series={[
              { name: "…Viagra claims", color: BRAND, points: fl.filter((r) => n(r.year) <= 2019).map((r) => ({ x: n(r.year), y: n(r.fl_share_of_viagra) })) },
              { name: "…drug-plan enrollees", color: CONTEXT, points: fl.filter((r) => n(r.year) <= 2019).map((r) => ({ x: n(r.year), y: n(r.fl_share_of_partd_enrollees) })) },
            ]}
            yMax={1}
            formatY={(v) => pct(v)}
            formatX={year}
            xTicks={[2013, 2015, 2017, 2019]}
          />
          <p className="figure-title">Plans covering Viagra-strength sildenafil as an extra, 2019</p>
          <div className="bars">
            {["Miami-Dade", "Rest of Florida", "Rest of US"].map((area) => (
              <div key={area}>
                <span>{area}</span>
                <i>
                  <b style={{ width: pct(cov2019(area).covering_share, 1), background: BRAND }} />
                </i>
                <strong>{pct(cov2019(area).covering_share)}</strong>
              </div>
            ))}
          </div>
          <DataTable
            columns={["Year", "FL share of Viagra claims", "FL share of all sildenafil", "FL share of enrollees"]}
            rows={fl.map((r) => [r.year, pct(r.fl_share_of_viagra, 1), pct(r.fl_share_of_all_sildenafil, 1), pct(r.fl_share_of_partd_enrollees, 1)])}
          />
        </>
      }
      sources={[
        { text: "CMS Medicare Monthly Enrollment (Part D enrollees) and Part D Prescribers by Geography and Drug, by state", query: `sql/02-miami.sql → florida_share (${peak.year})`, url: CMS_GEO },
        { text: "CMS Part D Prescribers by Provider and Drug, Florida, Viagra and Viagra-strength generic (rows with 11+ claims), 2013–2018", query: "sql/02-miami.sql → miami_share", url: CMS_PROVIDER },
        { text: "Same, prescriber concentration", query: "sql/02-miami.sql → prescriber_concentration", url: CMS_PROVIDER },
        { text: "CMS quarterly Part D formulary files, plan year 2019: excluded-drug (supplemental) file × plan service areas", query: "sql/02-miami.sql → plan_coverage (2019)", url: CMS_FORMULARY },
        { text: "CMS Medicare Monthly Enrollment, Medicare Advantage share, 2019", query: "sql/02-miami.sql → ma_penetration (2019)", url: "https://data.cms.gov/summary-statistics-on-beneficiary-enrollment/medicare-and-medicaid-reports/medicare-monthly-enrollment" },
      ]}
    >
      <p>
        Florida is home to about {pct(peak.fl_share_of_partd_enrollees, 1)} of
        Medicare's drug-plan enrollees. In {n(peak.year)} it accounted for{" "}
        {pct(peak.fl_share_of_viagra)} of Medicare's Viagra claims.
        <Cite section={id} n={1} />
      </p>
      <p>
        Inside Florida, prescribers in two cities, Miami and Hialeah, accounted
        for {pct(mhLow)} to {pct(mhHigh)} of the Viagra-strength claims each
        year through 2018.
        <Cite section={id} n={2} /> They came from at least{" "}
        {int.format(minPrescribers)} prescribers a year, and the ten busiest
        never wrote more than {pct(maxTop10)} of them. No small group of
        prescribers drove it.
        <Cite section={id} n={3} />
      </p>
      <p>
        A plan benefit fits the pattern. In 2019, the first year CMS's plan
        files are public, {pct(cov2019("Miami-Dade").covering_share)} of Part D
        plans sold in Miami-Dade covered Viagra-strength sildenafil as an
        extra. In the rest of the country, {pct(cov2019("Rest of US").covering_share, 1)} did.
        <Cite section={id} n={4} /> {pct(ma2019.miami_dade_ma_share)} of
        Miami-Dade's Medicare beneficiaries were in private Medicare Advantage
        plans that year, against {pct(ma2019.us_ma_share)} nationally.
        <Cite section={id} n={5} /> Why those plans chose to offer it, the data
        doesn't say.
      </p>
    </Chapter>
  );
}

function CliffChapter() {
  const id = "cliff";
  const monthly = rows(cliff, "nadac_monthly");
  const seriesFor = (b: string, mg: number) =>
    monthly.filter((r) => r.brand === b && n(r.mg) === mg).map((r) => ({ x: Date.parse(String(r.month)), y: n(r.per_tablet) }));
  const weeks = rows(cliff, "cliff_weeks");
  const plateau = weeks.filter((r) => String(r.as_of_date) < "2018-09-15");
  const before = plateau.at(-1)!;
  const bottom = weeks.reduce((a, b) => (n(b.per_tablet) < n(a.per_tablet) ? b : a));
  const firstDrop = weeks.find((r) => n(r.per_tablet) < 0.9 * n(before.per_tablet))!;
  const test = pick(cliff, "inflections", { event_date: "2018-06-11" });
  const nat = (y: number) => pick(cliff, "national_by_year", { year: y });
  const g2024 = pick(brand, "brand_vs_generic", { year: 2024 });
  const dateLabel = (value: unknown) =>
    new Date(String(value) + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return (
    <Chapter
      id={id}
      number="03 · The patent"
      title="Then the patent ran out."
      figure={
        <>
          <p className="figure-title">What a pharmacy paid for one 100 mg tablet (log scale)</p>
          <LineChart
            label="NADAC per-tablet price of brand Viagra and generic sildenafil 100 mg, monthly, log scale"
            log
            series={[
              { name: "Viagra", color: BRAND, points: seriesFor("Viagra", 100) },
              { name: "Generic", color: GENERIC, points: seriesFor("Generic", 100) },
            ]}
            formatY={(v) => (v < 1 ? `$${v.toFixed(2)}` : `$${int.format(v)}`)}
            formatX={(v) => String(new Date(v).getUTCFullYear())}
            formatTipX={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}
            xTicks={[2014, 2016, 2018, 2020, 2022, 2024, 2026].map((y) => Date.UTC(y, 0, 1))}
            markers={[
              { x: Date.UTC(2017, 11, 11), label: "Generic launch" },
              { x: Date.UTC(2020, 3, 22), label: "Last patent ends" },
            ]}
          />
          <DataTable
            columns={["Year", "Claims", "Medicare cost", "Cost per claim"]}
            rows={rows(cliff, "national_by_year").map((r) => [r.year, int.format(n(r.claims)), millions(r.cost), usd(r.cost_per_claim)])}
          />
        </>
      }
      sources={[
        { text: "Teva press release, Dec 11, 2017 (SEC 6-K)", url: "https://www.sec.gov/Archives/edgar/data/0000818686/000130901417001031/exhibit1.htm" },
        { text: "NADAC weekly, generic sildenafil 100 mg, Apr–Dec 2018 (median across NDCs)", query: "sql/03-patent-cliff.sql → cliff_weeks", url: NADAC },
        { text: "FDA approvals after Teva's 180-day exclusivity (openFDA Drugs@FDA); test date fixed before analysis in data/manual/events.csv", query: "sql/03-patent-cliff.sql → inflections (2018-06-11)", url: "https://api.fda.gov/drug/drugsfda.json?search=products.active_ingredients.name:%22SILDENAFIL%20CITRATE%22&limit=100" },
        { text: "NADAC, generic sildenafil 100 mg, 2024 mean", query: "sql/04-brand-price.sql → brand_vs_generic (2024)", url: NADAC },
        { text: "CMS Part D Prescribers by Geography and Drug, national, all sildenafil", query: "sql/03-patent-cliff.sql → national_by_year (2017, 2024)", url: CMS_GEO },
      ]}
    >
      <p>
        Generic Viagra went on sale on December 11, 2017.
        <Cite section={id} n={1} /> For its first months, pharmacies paid about{" "}
        {usd(before.per_tablet, 0)} a tablet for it, roughly what brand Viagra had
        cost in 2013.
        <Cite section={id} n={2} />
      </p>
      <p>
        Teva's six-month head start ended in early June 2018, and on June 11
        the FDA approved four more generics. We picked that date to test before looking
        at prices. The price didn't move on it.
        <Cite section={id} n={3} /> It held until {dateLabel(firstDrop.as_of_date)},
        then fell from {usd(before.per_tablet)} to {usd(bottom.per_tablet)} by{" "}
        {dateLabel(bottom.as_of_date)}, {n(test.months_after_event)} months
        later than the test date.
        <Cite section={id} n={2} /> By 2024, a generic tablet cost pharmacies{" "}
        {usd(g2024.generic_100mg)}.
        <Cite section={id} n={4} />
      </p>
      <p>
        Medicare's cost per sildenafil claim fell from{" "}
        {usd(nat(2017).cost_per_claim, 0)} in 2017 to{" "}
        {usd(nat(2024).cost_per_claim, 0)} in 2024. Its total sildenafil bill
        fell from {millions(nat(2017).cost)} to {millions(nat(2024).cost)},
        while the number of claims went from {int.format(n(nat(2017).claims))}{" "}
        to {int.format(n(nat(2024).claims))}.
        <Cite section={id} n={5} />
      </p>
    </Chapter>
  );
}

function SpreadChapter() {
  const id = "spread";
  const supp = rows(whoPays, "supplemental_share");
  const s = (y: number) => pick(whoPays, "supplemental_share", { plan_year: y });
  const cov = (y: number, area: string) => pick(miami, "plan_coverage", { plan_year: y, area });
  const fl = (y: number) => pick(miami, "florida_share", { year: y });
  const basic = rows(whoPays, "basic_formulary");
  const allPA = basic.every((r) => n(r.share_20mg_with_prior_auth) === 1);
  const noneEd = basic.every((r) => n(r.list_viagra_strengths) === 0);
  const mix = rows(whoPays, "mixture_estimate")[0];
  const mixLo = Math.min(n(mix.viagra_pattern_share_by_specialty), n(mix.viagra_pattern_share_by_age));
  const mixHi = Math.max(n(mix.viagra_pattern_share_by_specialty), n(mix.viagra_pattern_share_by_age));
  const medicaid = rows(whoPays, "medicaid_by_strength").filter((r) => n(r.year) >= 2017 && n(r.year) <= 2024);
  const medLo = Math.min(...medicaid.map((r) => n(r.rx_20mg) + n(r.rx_viagra_strengths)));
  const medHi = Math.max(...medicaid.map((r) => n(r.rx_20mg) + n(r.rx_viagra_strengths)));
  const flRows = rows(miami, "florida_share");
  const generic2024 = pick(law, "label_fingerprint", { year: 2024, label: "Generic (merged label)" });
  return (
    <Chapter
      id={id}
      number="04 · The spread"
      title="Then the extra went national."
      figure={
        <>
          <p className="figure-title">Medicare sildenafil claims</p>
          <LineChart
            label="Medicare sildenafil claims written inside and outside Florida, 2013 to 2024"
            series={[
              { name: "Outside Florida", color: GENERIC, points: flRows.map((r) => ({ x: n(r.year), y: n(r.claims_outside_fl) })) },
              { name: "Florida", color: BRAND, points: flRows.map((r) => ({ x: n(r.year), y: n(r.claims_in_fl) })) },
            ]}
            formatY={(v) => int.format(v)}
            formatX={year}
            xTicks={[2013, 2016, 2019, 2022, 2024]}
          />
          <p className="figure-title">Share of all Part D plans covering it as an extra</p>
          <LineChart
            label="Share of Part D plans covering Viagra-strength sildenafil as a supplemental benefit, 2019 to 2026"
            height={200}
            series={[{ name: "All plans", color: GENERIC, points: supp.map((r) => ({ x: n(r.plan_year), y: n(r.covering_share) })) }]}
            yMax={0.5}
            formatY={(v) => pct(v)}
            formatX={year}
            xTicks={[2019, 2021, 2023, 2026]}
          />
          <DataTable
            columns={["Plan year", "Plans", "Covering", "Share", "Typical limit / 30 days"]}
            rows={supp.map((r) => [r.plan_year, int.format(n(r.plans)), int.format(n(r.covering_plans)), pct(r.covering_share, 1), r.typical_tablets_per_30_days])}
          />
        </>
      }
      sources={[
        { text: "CMS quarterly Part D formulary files: excluded-drug (supplemental) file, all plans", query: "sql/05-who-pays.sql → supplemental_share", url: CMS_FORMULARY },
        { text: "Same, by area", query: "sql/02-miami.sql → plan_coverage (2019, 2024)", url: CMS_FORMULARY },
        { text: "CMS Part D Prescribers by Geography and Drug, by state", query: "sql/02-miami.sql → florida_share (2017, 2024)", url: CMS_GEO },
        { text: "CMS quarterly Part D formulary files: basic formulary, sildenafil RXCUIs, 2019–2026", query: "sql/05-who-pays.sql → basic_formulary", url: CMS_FORMULARY },
        { text: "Medicaid State Drug Utilization Data, national, sildenafil tablets by NDC strength, 2017–2024", query: "sql/05-who-pays.sql → medicaid_by_strength", url: "https://data.medicaid.gov/state-drug-utilization" },
        { text: "Estimate from 2018 label fingerprints (prescriber specialty; age 65+ share)", query: "sql/05-who-pays.sql → mixture_estimate", url: CMS_PROVIDER },
      ]}
    >
      <p>
        In 2019, {pct(s(2019).covering_share, 1)} of all Part D plans covered
        Viagra-strength sildenafil as an extra. By 2024, {pct(s(2024).covering_share)}{" "}
        did, usually capped at {n(s(2024).typical_tablets_per_30_days)} tablets a
        month.
        <Cite section={id} n={1} /> Outside Florida, the share went from{" "}
        {pct(cov(2019, "Rest of US").covering_share, 1)} to{" "}
        {pct(cov(2024, "Rest of US").covering_share)}.
        <Cite section={id} n={2} />
      </p>
      <p>
        Sildenafil claims written outside Florida went from{" "}
        {int.format(n(fl(2017).claims_outside_fl))} in 2017 to{" "}
        {int.format(n(fl(2024).claims_outside_fl))} in 2024. Florida's share of
        all of them fell from {pct(fl(2017).fl_share_of_all_sildenafil)} to{" "}
        {pct(fl(2024).fl_share_of_all_sildenafil)}.
        <Cite section={id} n={3} />
      </p>
      <p>
        The basic benefit never moved.{" "}
        {allPA && "Every basic formulary that lists the 20 mg pulmonary hypertension tablet requires prior authorization, "}
        {noneEd && "and none lists the 25, 50 or 100 mg strengths."}
        <Cite section={id} n={4} /> Medicaid, which has the same exclusion and
        no optional extras, filled between {int.format(medLo)} and{" "}
        {int.format(medHi)} sildenafil tablet prescriptions a year from 2017 to
        2024.
        <Cite section={id} n={5} />
      </p>
      <p className="estimate">
        <strong>Estimate.</strong> CMS stopped separating the two generics in
        2019. Judging by who prescribes it and how old the patients are, roughly{" "}
        {pct(mixLo)}–{pct(mixHi)} of 2024's {int.format(n(generic2024.claims))}{" "}
        generic claims look like the Viagra-strength product. That is an
        inference, not a count.
        <Cite section={id} n={6} />
      </p>
    </Chapter>
  );
}

function BrandChapter() {
  const id = "brand";
  const prices = rows(brand, "brand_vs_generic");
  const p = (y: number) => pick(brand, "brand_vs_generic", { year: y });
  const flat = rows(brand, "strength_flat_pricing");
  const pf = (y: number) => pick(brand, "pfizer_vs_partd", { year: y });
  const v2024 = pick(law, "viagra_by_year", { year: 2024 });
  return (
    <Chapter
      id={id}
      number="05 · The brand"
      title="The brand raised its price."
      figure={
        <>
          <p className="figure-title">What a pharmacy paid for one Viagra 100 mg tablet</p>
          <LineChart
            label="NADAC per-tablet price of brand Viagra 100 mg, annual mean, 2013 to 2026"
            series={[{ name: "Viagra 100 mg", color: BRAND, points: prices.map((r) => ({ x: n(r.year), y: n(r.viagra_100mg) })) }]}
            formatY={(v) => `$${int.format(v)}`}
            formatX={year}
            xTicks={[2013, 2016, 2019, 2022, 2026]}
            markers={[{ x: 2017.95, label: "Generic launch" }]}
          />
          <DataTable
            columns={["Year", "Pfizer US Viagra sales", "Medicare Viagra claims"]}
            rows={rows(brand, "pfizer_vs_partd").map((r) => [
              `${r.year}${n(r.months) < 12 ? ` (${r.months} mo)` : ""}`,
              `$${int.format(n(r.viagra_us_musd))}M`,
              r.partd_viagra_claims === null ? "—" : int.format(n(r.partd_viagra_claims)),
            ])}
          />
        </>
      }
      sources={[
        { text: "NADAC, Viagra 100 mg tablet, annual means", query: "sql/04-brand-price.sql → brand_vs_generic", url: NADAC },
        { text: "NADAC, Viagra 25/50/100 mg, 2014 medians", query: "sql/04-brand-price.sql → strength_flat_pricing", url: NADAC },
        { text: "Pfizer earnings releases (SEC Ex. 99), US Viagra revenue, 2016 and 2019", query: "data/manual/pfizer-revenue.csv", url: "https://www.sec.gov/Archives/edgar/data/78003/000007800320000003/pfe-12312019xex99.htm" },
        { text: "CMS Part D Prescribers by Geography and Drug, national, Viagra, 2024", query: "sql/01-law.sql → viagra_by_year (2024)", url: CMS_GEO },
      ]}
    >
      <p>
        Pharmacies paid {usd(p(2013).viagra_100mg)} for a Viagra tablet in 2013,{" "}
        {usd(p(2017).viagra_100mg)} in 2017 and {usd(p(2024).viagra_100mg)} in
        2024, {int.format(n(p(2024).brand_multiple))} times the price of the
        generic.
        <Cite section={id} n={1} /> Every strength cost the same: in 2014, a 25
        mg tablet was {usd(flat[0].per_tablet_2014)} and a 100 mg tablet was{" "}
        {usd(flat.at(-1)!.per_tablet_2014)}.
        <Cite section={id} n={2} />
      </p>
      <p>
        Pfizer's US Viagra sales fell from ${int.format(n(pf(2016).viagra_us_musd))}{" "}
        million in 2016 to ${int.format(n(pf(2019).viagra_us_musd))} million in
        2019.
        <Cite section={id} n={3} /> Medicare still recorded{" "}
        {int.format(n(v2024.claims))} brand-name Viagra claims in 2024, at{" "}
        {usd(v2024.cost_per_claim, 0)} each.
        <Cite section={id} n={4} />
      </p>
    </Chapter>
  );
}

function CashChapter() {
  const id = "cash";
  const cp = rows(cash, "costplus");
  const cp100 = cp.find((r) => r.strength === "100mg")!;
  const partd = pick(cash, "partd_vs_nadac", { year: 2024 });
  const brand2024 = pick(brand, "brand_vs_generic", { year: 2024 });
  const tabletsPerClaim = n(partd.partd_per_claim) / n(partd.partd_per_unit);
  return (
    <Chapter
      id={id}
      number="06 · The market"
      title="Cash is now cheaper than coverage."
      figure={
        <>
          <p className="figure-title">One sildenafil tablet, four prices (log scale)</p>
          <DotPlot
            label="Price of one sildenafil tablet: brand Viagra at pharmacy cost, Medicare gross spending per generic tablet, generic at pharmacy cost, and Cost Plus Drugs"
            formatX={(v) => (v < 1 ? `$${v.toFixed(v < 0.1 ? 3 : 2)}` : `$${v.toFixed(2)}`)}
            rows={[
              { label: "Viagra 100 mg, pharmacy cost (2024)", value: n(brand2024.viagra_100mg), color: BRAND },
              { label: "Generic, Medicare gross spend (2024)", value: n(partd.partd_per_unit), color: GENERIC },
              { label: "Generic 100 mg, pharmacy cost (2024)", value: n(brand2024.generic_100mg), color: GENERIC },
              { label: "Generic 100 mg, Cost Plus Drugs (today)", value: n(cp100.price_per_unit), color: GENERIC },
            ]}
          />
        </>
      }
      sources={[
        { text: `Mark Cuban Cost Plus Drugs price list, fetched ${cp100.fetched_on}`, query: "sql/06-cash.sql → costplus", url: "https://api.costplusdrugs.com/pricelist/cpd" },
        { text: "CMS Part D Spending by Drug, generic sildenafil (all manufacturers), 2024", query: "sql/06-cash.sql → partd_vs_nadac (2024)", url: "https://data.cms.gov/summary-statistics-on-use-and-payments/medicare-medicaid-spending-by-drug/medicare-part-d-spending-by-drug" },
        { text: "NADAC, generic sildenafil 20 mg, 2024 median", query: "sql/06-cash.sql → partd_vs_nadac (2024)", url: NADAC },
        { text: "Hims & Hers Form S-1 (2021): launched 2017; ED among first offerings; 280,000+ subscriptions at Sept 30, 2020", url: "https://www.sec.gov/Archives/edgar/data/1773751/000119312521030981/d95702ds1.htm" },
      ]}
    >
      <p>
        Mark Cuban Cost Plus Drugs sells generic 100 mg sildenafil for{" "}
        {usd(cp100.price_per_unit, 3)} a tablet; 30 tablets, shipped, come to{" "}
        {usd(cp100.total_30_tablets_shipped)}.
        <Cite section={id} n={1} /> Medicare's average generic sildenafil claim
        in 2024 cost {usd(partd.partd_per_claim)}, for about{" "}
        {Math.round(tabletsPerClaim)} doses.
        <Cite section={id} n={2} />
      </p>
      <p>
        Per dose, Medicare's gross spending was {usd(partd.partd_per_unit)},
        about {Math.round(n(partd.partd_multiple_of_nadac_20mg))} times what
        pharmacies paid for a generic 20 mg tablet that year. Gross spending
        includes dispensing fees and comes before manufacturer rebates.
        <Cite section={id} n={[2, 3]} />
      </p>
      <p>
        None of the cash market shows up in Medicare data. Hims launched in
        2017 with erectile dysfunction among its first products and had more
        than 280,000 subscriptions by 2020.
        <Cite section={id} n={4} /> We could not find a reliable public figure
        for how much of the market now pays cash, so that number stays blank.
      </p>
    </Chapter>
  );
}

export function Chapters() {
  return (
    <>
      <LawChapter />
      <MiamiChapter />
      <CliffChapter />
      <SpreadChapter />
      <BrandChapter />
      <CashChapter />
    </>
  );
}

export function Checks() {
  const spending = rows(checks, "reconcile_spending");
  const states = rows(checks, "states_vs_national");
  const nadac = rows(checks, "nadac_vs_cost_per_claim")[0];
  const pfizer = rows(checks, "pfizer_direction");
  const inflection = pick(cliff, "inflections", { event_date: "2018-06-11" });
  const volume = rows(cliff, "volume_inflection")[0];
  const fl = (y: number) => pick(miami, "florida_share", { year: y });
  const outsideViagra = (y: number) => n(fl(y).us_viagra_claims) - n(fl(y).fl_viagra_claims);
  const rev = (y: number) => pick(brand, "revatio", { year: y });
  const pf2016 = pick(brand, "pfizer_vs_partd", { year: 2016 });
  const medicareShareOfPfizer = n(pf2016.partd_viagra_cost) / (n(pf2016.viagra_us_musd) * 1e6);
  const unverified = [
    `Why Viagra claims outside Florida fell ${pct(1 - outsideViagra(2014) / outsideViagra(2013))} from 2013 to 2014. Plan formulary files before 2019 aren't published on data.cms.gov, and we found no CMS or news explanation.`,
    "Why Miami-Dade plans offered the benefit when plans elsewhere mostly didn't.",
    "Why the generic price fell months after Teva's exclusivity ended rather than on the date. NADAC is built from pharmacy invoice surveys, which may lag; we didn't confirm that.",
    "How much of 2024's generic sildenafil is the Viagra-strength product. The share above is an estimate from prescriber and age patterns.",
    "Totals for 2013–2019 against CMS Spending by Drug. Only the 2020–2024 vintage is published on data.cms.gov; those years reconcile above.",
    `Why brand Revatio's cost per claim rose from ${usd(rev(2013).cost_per_claim, 0)} (2013) to ${usd(rev(2024).cost_per_claim, 0)} (2024). The public data doesn't separate tablets, suspension and injection.`,
    "The share of US sildenafil bought with cash.",
  ];
  const items = [
    {
      check: "Our national totals match CMS Part D Spending by Drug (generic within 1%; brands within 100 claims), 2020–2024",
      pass: spending.every((r) => r.pass),
      detail: `${spending.filter((r) => r.pass).length} of ${spending.length} brand-years pass; largest generic gap ${pct(Math.max(...spending.filter((r) => r.brand === "Generic").map((r) => Math.abs(n(r.cost_diff)))), 2)}.`,
      query: "sql/07-checks.sql → reconcile_spending",
    },
    {
      check: "State rows add up to the national row, every year",
      pass: states.every((r) => r.pass),
      detail: `Coverage ${pct(Math.min(...states.map((r) => n(r.coverage))), 2)} or better.`,
      query: "sql/07-checks.sql → states_vs_national",
    },
    {
      check: "The generic price drop lands on the pre-registered date (June 11, 2018, within 2 months)",
      pass: inflection.lands_on_event === true,
      detail: `Steepest monthly drop came ${inflection.months_after_event} months after the date. The story says so.`,
      query: "sql/03-patent-cliff.sql → inflections",
    },
    {
      check: "The Viagra-strength generic first appears in Part D in the launch year, as single fills",
      pass: n(volume.generic_viagra_label_first_year) === 2017 && n(volume.first_year_claims_per_bene) <= 1.05,
      detail: `First year ${volume.generic_viagra_label_first_year}; ${n(volume.first_year_claims_per_bene).toFixed(2)} claims per person.`,
      query: "sql/03-patent-cliff.sql → volume_inflection",
    },
    {
      check: "NADAC per-tablet price and Medicare cost per claim both fall by more than half, 2017–2021",
      pass: nadac.pass === true,
      detail: `Tablet ${pct(nadac.nadac_100mg_change_2017_2021, 1)}, cost per claim ${pct(nadac.cost_per_claim_change_2017_2021, 1)}.`,
      query: "sql/07-checks.sql → nadac_vs_cost_per_claim",
    },
    {
      check: "Pfizer US Viagra revenue moves the same direction as Medicare Viagra claims, year by year",
      pass: pfizer.every((r) => r.pass),
      detail: `Agrees in ${pfizer.filter((r) => r.pass).map((r) => r.year).join(", ")}; disagrees in ${pfizer.filter((r) => !r.pass).map((r) => r.year).join(", ")}. Before the generic, Medicare's Viagra spending was ${pct(medicareShareOfPfizer, 1)} of Pfizer's US Viagra sales (2016) and moved on its own.`,
      query: "sql/07-checks.sql → pfizer_direction",
    },
  ];
  return (
    <section className="checks" id="checks">
      <p className="kicker">How we checked this</p>
      <h2>Six tests that don't depend on us.</h2>
      <ul className="check-list">
        {items.map((item) => (
          <li key={item.check} className={item.pass ? "pass" : "fail"}>
            <span className="check-flag">{item.pass ? "PASS" : "FAIL"}</span>
            <div>
              <strong>{item.check}</strong>
              <p>{item.detail}</p>
              <code>{item.query}</code>
            </div>
          </li>
        ))}
      </ul>
      <h3>What we couldn't verify</h3>
      <ul className="unverified">
        {unverified.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
