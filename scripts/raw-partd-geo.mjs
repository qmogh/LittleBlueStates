// Part D Prescribers by Geography and Drug: every sildenafil row (national + state), every year.
import { cmsRows, writeCsv } from "./lib/raw.mjs";
import { PARTD_GEO_DATASET_IDS } from "./lib/sources.mjs";

const rows = [];
for (const [year, id] of Object.entries(PARTD_GEO_DATASET_IDS)) {
  const records = await cmsRows(id, { Gnrc_Name: "Sildenafil Citrate" });
  rows.push(...records.map((record) => ({ year, ...record })));
  console.log(`${year}: ${records.length} rows`);
}
await writeCsv("partd-geo.csv", rows);
