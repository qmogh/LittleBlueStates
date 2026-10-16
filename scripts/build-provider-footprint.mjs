import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { parse } from "csv-parse";
import { PARTD_PROVIDER_CSV_URLS } from "./lib/sources.mjs";

const SOURCE_URL = PARTD_PROVIDER_CSV_URLS[2024];
const OUTPUT_PATH = resolve("src/data/provider-footprint-2024.json");
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

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getState(states, code) {
  if (!states.has(code))
    states.set(code, { cities: new Map(), specialties: new Map() });
  return states.get(code);
}

function addAggregate(map, key, claims, npi) {
  if (!map.has(key)) map.set(key, { claims: 0, providers: new Set() });
  const target = map.get(key);
  target.claims += claims;
  if (npi) target.providers.add(npi);
}

const response = await fetch(SOURCE_URL);
if (!response.ok || !response.body)
  throw new Error(
    `CMS provider-drug request failed: ${response.status} ${response.statusText}`,
  );

const parser = Readable.fromWeb(response.body).pipe(
  parse({ columns: true, bom: true, skip_empty_lines: true }),
);
const states = new Map();
let rowsRead = 0;
let sildenafilRows = 0;

for await (const record of parser) {
  rowsRead += 1;
  if (
    record.Gnrc_Name !== "Sildenafil Citrate" ||
    !stateCodes.has(record.Prscrbr_State_Abrvtn)
  )
    continue;
  const claims = numeric(record.Tot_Clms);
  if (claims === 0) continue;
  sildenafilRows += 1;
  const state = getState(states, record.Prscrbr_State_Abrvtn);
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
    console.log(
      `Read ${rowsRead.toLocaleString()} rows; kept ${sildenafilRows.toLocaleString()} sildenafil rows`,
    );
}

const toRows = (map, label) =>
  [...map.entries()]
    .map(([name, value]) => ({
      [label]: name,
      claims: value.claims,
      providers: value.providers.size,
    }))
    .sort((a, b) => b.claims - a.claims || a[label].localeCompare(b[label]));

const snapshot = {
  metadata: {
    year: 2024,
    source:
      "Centers for Medicare & Medicaid Services — Medicare Part D Prescribers by Provider and Drug",
    sourceUrl: SOURCE_URL,
    scope:
      "Reported Medicare Part D sildenafil claims, grouped by prescriber practice city and specialty.",
    notes: [
      "City is the prescriber practice location reported in NPPES; it is not patient residence or pharmacy location.",
      "Claims include original prescriptions and refills.",
      "Provider-level rows below CMS suppression thresholds are not present in the source file.",
    ],
  },
  states: [...states.entries()]
    .map(([code, state]) => ({
      code,
      cities: toRows(state.cities, "city"),
      specialties: toRows(state.specialties, "specialty"),
    }))
    .sort((a, b) => a.code.localeCompare(b.code)),
};

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(
  `Wrote ${sildenafilRows.toLocaleString()} provider-drug rows from ${rowsRead.toLocaleString()} source rows to ${OUTPUT_PATH}`,
);
