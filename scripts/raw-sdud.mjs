// Medicaid State Drug Utilization Data by NDC: sildenafil, Viagra, Revatio, 2010–present.
import { medicaidDatasetsByYear, medicaidRows, writeCsv } from "./lib/raw.mjs";

const datasets = (await medicaidDatasetsByYear("State Drug Utilization Data")).filter(
  ({ year }) => year >= 2010,
);
const rows = [];
for (const { year, identifier } of datasets) {
  for (const prefix of ["SILDENAF%", "VIAGRA%", "REVATIO%"]) {
    rows.push(...(await medicaidRows(identifier, { product_name: prefix })));
  }
  console.log(`${year}: ${rows.length} rows so far`);
}
await writeCsv("sdud.csv", rows);
