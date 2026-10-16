// Helpers for the data:raw:* scripts. Raw extracts land in data/raw/ (gitignored)
// and are read by the DuckDB queries in sql/.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const RAW_DIR = resolve("data/raw");

export async function fetchJson(url, attempts = 4) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return await response.json();
    } catch (error) {
      if (attempt >= attempts) throw error;
      await new Promise((done) => setTimeout(done, 1000 * attempt));
    }
  }
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function writeCsv(name, rows) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ];
  await mkdir(RAW_DIR, { recursive: true });
  const path = resolve(RAW_DIR, name);
  await writeFile(path, `${lines.join("\n")}\n`);
  console.log(`Wrote ${rows.length.toLocaleString()} rows to ${path}`);
}

// data.cms.gov data-api: `filters` is { column: value }.
export async function cmsRows(datasetId, filters = {}) {
  const query = Object.entries(filters)
    .map(([key, value]) => `filter[${key}]=${encodeURIComponent(value)}`)
    .join("&");
  const rows = [];
  for (let offset = 0; ; offset += 5000) {
    const page = await fetchJson(
      `https://data.cms.gov/data-api/v1/dataset/${datasetId}/data?${query}&size=5000&offset=${offset}`,
    );
    rows.push(...page);
    if (page.length < 5000) return rows;
  }
}

// data.medicaid.gov datastore: `like` is { column: "PREFIX%" } (case-insensitive).
export async function medicaidRows(datasetId, like) {
  const query = Object.entries(like)
    .map(
      ([key, value], index) =>
        `conditions[${index}][property]=${key}&conditions[${index}][value]=${encodeURIComponent(value)}&conditions[${index}][operator]=LIKE`,
    )
    .join("&");
  const rows = [];
  for (let offset = 0; ; offset += 5000) {
    const page = await fetchJson(
      `https://data.medicaid.gov/api/1/datastore/query/${datasetId}/0?${query}&limit=5000&offset=${offset}`,
    );
    rows.push(...page.results);
    if (page.results.length < 5000) return rows;
  }
}

// data.medicaid.gov keeps one dataset per year; find them by title.
export async function medicaidDatasetsByYear(titlePrefix) {
  const search = await fetchJson(
    `https://data.medicaid.gov/api/1/search?fulltext=${encodeURIComponent(titlePrefix)}&page-size=100`,
  );
  return Object.values(search.results)
    .map(({ title, identifier }) => ({
      year: Number(title.slice(titlePrefix.length).trim()),
      title,
      identifier,
    }))
    .filter(({ title, year }) => title.startsWith(titlePrefix) && year)
    .sort((a, b) => a.year - b.year);
}
