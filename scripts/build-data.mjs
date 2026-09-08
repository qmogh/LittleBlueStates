import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DATASET_IDS = {
  2013: "9aec2a70-4ef2-438a-bc35-1747fe2492c9",
  2014: "63099eb4-6c9e-4fec-8c9e-b6b132f1b7f4",
  2015: "73748d0b-2acb-420a-ac66-27d8e238fdc8",
  2016: "c5b3c840-5eb2-4e4c-ac35-c30995dcb051",
  2017: "7863e41c-3f6f-4889-93a8-be65e9f3d073",
  2018: "b083c9b6-b841-4676-8d0a-fb03ee1431a1",
  2019: "73a6335e-f16f-4c81-a84b-6b5a986e2bf8",
  2020: "83891e77-99cf-4865-b60a-97703b916e09",
  2021: "7dda2a9d-034a-446a-b4b3-e1254e0127b2",
  2022: "1fc57194-a51d-4864-aee6-de0889488151",
  2023: "3463648b-1971-478d-84ca-80cadc758153",
  2024: "9b4c142c-69cc-4a96-a09a-7cf2ba7f5816",
};
const OUTPUT_PATH = resolve("src/data/sildenafil-2024.json");

function sourceUrl(datasetId) {
  return `https://data.cms.gov/data-api/v1/dataset/${datasetId}/data?filter%5BGnrc_Name%5D=Sildenafil%20Citrate&filter%5BPrscrbr_Geo_Lvl%5D=State&size=500`;
}

const stateCodes = {
  "01": "AL",
  "02": "AK",
  "04": "AZ",
  "05": "AR",
  "06": "CA",
  "08": "CO",
  "09": "CT",
  10: "DE",
  11: "DC",
  12: "FL",
  13: "GA",
  15: "HI",
  16: "ID",
  17: "IL",
  18: "IN",
  19: "IA",
  20: "KS",
  21: "KY",
  22: "LA",
  23: "ME",
  24: "MD",
  25: "MA",
  26: "MI",
  27: "MN",
  28: "MS",
  29: "MO",
  30: "MT",
  31: "NE",
  32: "NV",
  33: "NH",
  34: "NJ",
  35: "NM",
  36: "NY",
  37: "NC",
  38: "ND",
  39: "OH",
  40: "OK",
  41: "OR",
  42: "PA",
  44: "RI",
  45: "SC",
  46: "SD",
  47: "TN",
  48: "TX",
  49: "UT",
  50: "VT",
  51: "VA",
  53: "WA",
  54: "WV",
  55: "WI",
  56: "WY",
  72: "PR",
};

function number(value) {
  if (value === "" || value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function blankMetrics() {
  return {
    claims: 0,
    prescribers: 0,
    beneficiaries: 0,
    fills30Day: 0,
    drugCost: 0,
    beneficiaryCostShare: 0,
  };
}

function addMetrics(target, record) {
  target.claims += number(record.Tot_Clms) ?? 0;
  target.prescribers += number(record.Tot_Prscrbrs) ?? 0;
  target.beneficiaries += number(record.Tot_Benes) ?? 0;
  target.fills30Day += number(record.Tot_30day_Fills) ?? 0;
  target.drugCost += number(record.Tot_Drug_Cst) ?? 0;
  target.beneficiaryCostShare +=
    (number(record.LIS_Bene_Cst_Shr) ?? 0) +
    (number(record.NonLIS_Bene_Cst_Shr) ?? 0);
}

function brandKey(name) {
  if (name === "Viagra") return "viagra";
  if (name === "Revatio") return "revatio";
  return "generic";
}

function buildStates(records) {
  const states = new Map();
  for (const record of records) {
    const code = record.Prscrbr_Geo_Cd;
    if (!stateCodes[code]) continue;
    if (!states.has(code)) {
      states.set(code, {
        fips: code,
        code: stateCodes[code],
        name: record.Prscrbr_Geo_Desc,
        ...blankMetrics(),
        age65Plus: blankMetrics(),
        brands: {
          generic: blankMetrics(),
          viagra: blankMetrics(),
          revatio: blankMetrics(),
        },
      });
    }
    const state = states.get(code);
    addMetrics(state, record);
    addMetrics(state.brands[brandKey(record.Brnd_Name)], record);
    addMetrics(state.age65Plus, {
      Tot_Clms: record.GE65_Tot_Clms,
      Tot_30day_Fills: record.GE65_Tot_30day_Fills,
      Tot_Drug_Cst: record.GE65_Tot_Drug_Cst,
      Tot_Benes: record.GE65_Tot_Benes,
      Tot_Prscrbrs: "",
      LIS_Bene_Cst_Shr: "",
      NonLIS_Bene_Cst_Shr: "",
    });
  }
  return [...states.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function toTimelineState(state) {
  return {
    fips: state.fips,
    code: state.code,
    name: state.name,
    claims: state.claims,
    fills30Day: state.fills30Day,
    drugCost: state.drugCost,
    age65Plus: { claims: state.age65Plus.claims },
    brands: Object.fromEntries(
      Object.entries(state.brands).map(([brand, metrics]) => [
        brand,
        { claims: metrics.claims },
      ]),
    ),
  };
}

const yearly = await Promise.all(
  Object.entries(DATASET_IDS).map(async ([year, datasetId]) => {
    const response = await fetch(sourceUrl(datasetId));
    if (!response.ok)
      throw new Error(
        `CMS request for ${year} failed: ${response.status} ${response.statusText}`,
      );
    const records = await response.json();
    if (!Array.isArray(records))
      throw new Error(`CMS response for ${year} was not an array`);
    return {
      year: Number(year),
      states: buildStates(records).map(toTimelineState),
    };
  }),
);
yearly.sort((a, b) => a.year - b.year);
const latest = yearly.at(-1);

const snapshot = {
  metadata: {
    title: "Medicare Part D Prescribers — by Geography and Drug",
    year: latest.year,
    years: yearly.map(({ year }) => year),
    unit: "claims (original prescriptions and refills)",
    scope:
      "Medicare Part D claims for records with generic name Sildenafil Citrate",
    source: "Centers for Medicare & Medicaid Services",
    sourceUrl: sourceUrl(DATASET_IDS[2024]),
    datasetIds: DATASET_IDS,
    notes: [
      "Sildenafil Citrate includes brand and generic records; it is not synonymous with Viagra.",
      "The source is Medicare Part D, not all prescriptions in the United States.",
      "Blank source values are treated as unavailable and excluded from totals for that field.",
    ],
  },
  states: latest.states,
  yearly,
};

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(
  `Wrote ${snapshot.states.length} state and territory records across ${snapshot.metadata.years.length} years to ${OUTPUT_PATH}`,
);
