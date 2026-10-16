// Part D Spending by Drug (2020–2024 vintage): sildenafil rows, used only to reconcile our totals.
import { cmsRows, writeCsv } from "./lib/raw.mjs";

const SPENDING_BY_DRUG_2024 = "7e0b4365-fd63-4a29-8f5e-e0ac9f66a81b";
await writeCsv(
  "partd-spending.csv",
  await cmsRows(SPENDING_BY_DRUG_2024, { Gnrc_Name: "Sildenafil Citrate" }),
);
