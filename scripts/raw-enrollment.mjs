// Medicare Monthly Enrollment, annual rows: Part D enrollees by nation, state, and county.
import { cmsRows, writeCsv } from "./lib/raw.mjs";

const MONTHLY_ENROLLMENT = "d7fabe1e-d19b-4333-9eff-e80e0643f2fd";
const KEEP = [
  "YEAR", "BENE_GEO_LVL", "BENE_STATE_ABRVTN", "BENE_STATE_DESC", "BENE_COUNTY_DESC",
  "BENE_FIPS_CD", "TOT_BENES", "MA_AND_OTH_BENES", "MALE_TOT_BENES",
  "PRSCRPTN_DRUG_TOT_BENES", "PRSCRPTN_DRUG_PDP_BENES", "PRSCRPTN_DRUG_MAPD_BENES",
];
const rows = [];
for (const level of ["National", "State", "County"]) {
  const records = await cmsRows(MONTHLY_ENROLLMENT, { MONTH: "Year", BENE_GEO_LVL: level });
  rows.push(...records.map((record) => Object.fromEntries(KEEP.map((key) => [key, record[key]]))));
  console.log(`${level}: ${records.length} rows`);
}
await writeCsv("enrollment.csv", rows);
