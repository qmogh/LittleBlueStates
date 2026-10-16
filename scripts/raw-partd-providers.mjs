// Part D Prescribers by Provider and Drug: stream each year's full CSV (several GB) and keep
// sildenafil rows. Prescriber names are dropped; the story never singles out a clinician.
// Usage: node scripts/raw-partd-providers.mjs [year ...]   (default: every year)
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { parse } from "csv-parse/sync";
import { writeCsv } from "./lib/raw.mjs";
import { PARTD_PROVIDER_CSV_URLS } from "./lib/sources.mjs";

const DROP = new Set(["Prscrbr_Last_Org_Name", "Prscrbr_First_Name"]);
const years = process.argv.slice(2).length
  ? process.argv.slice(2)
  : Object.keys(PARTD_PROVIDER_CSV_URLS);

await Promise.all(
  years.map(async (year) => {
    const response = await fetch(PARTD_PROVIDER_CSV_URLS[year]);
    if (!response.ok || !response.body)
      throw new Error(`CMS provider file for ${year} failed: ${response.status}`);
    // A plain substring test on each line is far cheaper than CSV-parsing ~25M rows;
    // only the header and matching lines get parsed (and re-checked) below.
    const lines = [];
    for await (const line of createInterface({ input: Readable.fromWeb(response.body) })) {
      if (lines.length === 0 || line.includes("Sildenafil Citrate")) lines.push(line);
    }
    const rows = parse(lines.join("\n"), { columns: true, bom: true })
      .filter((record) => record.Gnrc_Name === "Sildenafil Citrate")
      .map((record) => ({
        year,
        ...Object.fromEntries(Object.entries(record).filter(([key]) => !DROP.has(key))),
      }));
    await writeCsv(`partd-providers-${year}.csv`, rows);
  }),
);
