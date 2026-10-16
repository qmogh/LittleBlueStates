import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { parse } from "csv-parse";

const SOURCE_URLS = {
  2013: "https://data.cms.gov/sites/default/files/2024-05/5fb694b1-2ec5-4e00-8efe-14161bdbdbea/MUP_DPR_RY24_P04_V10_DY13_NPIBN.csv",
  2014: "https://data.cms.gov/sites/default/files/2024-05/06e87540-68a5-4a10-bf9c-a0521dc4ebed/MUP_DPR_RY24_P04_V10_DY14_NPIBN.csv",
  2015: "https://data.cms.gov/sites/default/files/2024-05/bc1caf7f-dcbb-4258-b243-ee3666b6a20b/MUP_DPR_RY24_P04_V10_DY15_NPIBN.csv",
  2016: "https://data.cms.gov/sites/default/files/2024-05/67c457c6-b62d-424f-ad85-2bb8117c928d/MUP_DPR_RY24_P04_V10_DY16_NPIBN.csv",
  2017: "https://data.cms.gov/sites/default/files/2024-05/d9d685a0-dc49-4da5-9416-4cf3e6349296/MUP_DPR_RY24_P04_V10_DY17_NPIBN.csv",
  2018: "https://data.cms.gov/sites/default/files/2024-05/be3019b4-1164-4b40-af5d-cab40847d222/MUP_DPR_RY24_P04_V10_DY18_NPIBN.csv",
  2019: "https://data.cms.gov/sites/default/files/2024-05/129e7c21-d492-425b-be03-d2e59d933ab6/MUP_DPR_RY24_P04_V10_DY19_NPIBN.csv",
  2020: "https://data.cms.gov/sites/default/files/2024-05/75fecc51-c9e8-4904-b570-9da9dc101721/MUP_DPR_RY24_P04_V10_DY20_NPIBN.csv",
  2021: "https://data.cms.gov/sites/default/files/2024-05/43359391-e7fa-40b9-9bd4-5dc295e18712/MUP_DPR_RY24_P04_V10_DY21_NPIBN.csv",
  2022: "https://data.cms.gov/sites/default/files/2024-05/18f82097-61a6-4889-9941-9a0b6ad7523c/MUP_DPR_RY24_P04_V10_DY22_NPIBN.csv",
  2023: "https://data.cms.gov/sites/default/files/2025-04/0d5915ce-002c-4d87-bde8-24ffb08bb6cc/MUP_DPR_RY25_P04_V10_DY23_NPIBN.csv",
};
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
