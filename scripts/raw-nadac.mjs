// NADAC weekly pharmacy acquisition cost: every sildenafil, Viagra, and Revatio row, 2013–present.
import { medicaidDatasetsByYear, medicaidRows, writeCsv } from "./lib/raw.mjs";

const datasets = await medicaidDatasetsByYear("NADAC (National Average Drug Acquisition Cost)");
const rows = [];
for (const { year, identifier } of datasets) {
  for (const prefix of ["SILDENAFIL%", "VIAGRA%", "REVATIO%"]) {
    const records = await medicaidRows(identifier, { ndc_description: prefix });
    rows.push(...records.map((record) => ({ dataset_year: year, ...record })));
  }
  console.log(`${year}: ${rows.length} rows so far`);
}
await writeCsv("nadac.csv", rows);
