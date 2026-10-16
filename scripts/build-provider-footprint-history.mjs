import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { parse } from "csv-parse";
import { PARTD_PROVIDER_CSV_URLS } from "./lib/sources.mjs";

const { 2024: _latest, ...SOURCE_URLS } = PARTD_PROVIDER_CSV_URLS;
const OUTPUT_PATH = resolve("src/data/provider-footprint-history.json");
const stateCodes = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "PR",
]);

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function addAggregate(map, key, claims, npi) {
  if (!map.has(key)) map.set(key, { claims: 0, providers: new Set() });
  const aggregate = map.get(key);
  aggregate.claims += claims;
  if (npi) aggregate.providers.add(npi);
}

function toRows(map, label, limit) {
  return [...map.entries()]
    .map(([name, value]) => ({
      [label]: name,
      claims: value.claims,
      providers: value.providers.size,
    }))
    .sort((a, b) => b.claims - a.claims || a[label].localeCompare(b[label]))
    .slice(0, limit);
}

async function buildYear(year, url) {
  const response = await fetch(url);
  if (!response.ok || !response.body)
    throw new Error(`CMS provider file for ${year} failed: ${response.status}`);

  console.log(`Streaming ${year}…`);
  const parser = Readable.fromWeb(response.body).pipe(
    parse({ columns: true, bom: true, skip_empty_lines: true }),
  );
  const states = new Map();
  let rowsRead = 0;
  let kept = 0;

  for await (const record of parser) {
    rowsRead += 1;
    if (
      record.Gnrc_Name !== "Sildenafil Citrate" ||
      !stateCodes.has(record.Prscrbr_State_Abrvtn)
    )
      continue;
    const claims = number(record.Tot_Clms);
    if (!claims) continue;
    kept += 1;
    const code = record.Prscrbr_State_Abrvtn;
    if (!states.has(code))
      states.set(code, { cities: new Map(), specialties: new Map() });
    const state = states.get(code);
    addAggregate(
      state.cities,
      record.Prscrbr_City?.trim() || "Unknown city",
      claims,
      record.Prscrbr_NPI,
    );
    addAggregate(
      state.specialties,
      record.Prscrbr_Type?.trim() || "Unreported specialty",
      claims,
      record.Prscrbr_NPI,
    );
    if (rowsRead % 500000 === 0)
      console.log(`  ${year}: ${rowsRead.toLocaleString()} rows read.`);
  }

  console.log(
    `  ${year}: kept ${kept.toLocaleString()} sildenafil provider rows.`,
  );
  return {
    year,
    states: [...states.entries()]
      .map(([code, state]) => ({
        code,
        cities: toRows(state.cities, "city", 5),
        specialties: toRows(state.specialties, "specialty", 4),
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
  };
}

const snapshot = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
const completed = new Set(snapshot.yearly.map(({ year }) => year));

for (const [year, url] of Object.entries(SOURCE_URLS)) {
  const numericYear = Number(year);
  if (completed.has(numericYear)) {
    console.log(`${year} already complete; skipping.`);
    continue;
  }
  snapshot.yearly.push(await buildYear(numericYear, url));
  snapshot.yearly.sort((a, b) => a.year - b.year);
  await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Saved ${year}; the job can safely resume from here.`);
}
