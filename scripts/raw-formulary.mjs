// CMS quarterly Part D formulary files (2019+; earlier years are not published on data.cms.gov).
// Each release is a ~2.5 GB zip of zips. HTTP range requests pull out only the small members:
// plan information, the excluded-drugs file (supplemental coverage, by NDC), the basic
// formulary (by RXCUI; filtered to sildenafil), and the county locator.
import { inflateRawSync } from "node:zlib";
import { fetchJson, writeCsv } from "./lib/raw.mjs";

// One release per plan year, taken as early in the plan year as CMS published it.
const RELEASES = {
  2019: "https://data.cms.gov/sites/default/files/2023-11/ee424519-cbdf-4c50-b180-0b9497a50641/SPUF_2019_20190227.zip",
  2020: "https://data.cms.gov/sites/default/files/2023-11/918dad58-7e10-4472-8c5c-cecf4c2bd8bb/SPUF_2020_20200228.zip",
  2021: "https://data.cms.gov/sites/default/files/2023-11/2b74bb8d-73f3-464d-80ee-22d10c10a4ad/SPUF_2021_20210226.zip",
  2022: "https://data.cms.gov/sites/default/files/2023-11/f0c81466-a928-4618-904e-9828e843f970/SPUF_2022_20220311.zip",
  2023: "https://data.cms.gov/sites/default/files/2023-11/d83b7a01-221a-436a-bf0f-233f1fe59a76/SPUF_2023_20230310.zip",
  2024: "https://data.cms.gov/sites/default/files/2025-04/09f4af93-d0b0-477c-99dc-c9a253d791c7/SPUF_2024_20250331_2024Q1.zip",
  2025: "https://data.cms.gov/sites/default/files/2025-04/f868af60-dc78-4e9f-982c-31f53c1ad6a6/SPUF_2025_20250410.zip",
  2026: "https://data.cms.gov/sites/default/files/2026-04/65e8dafd-c42b-4c2a-93c2-551bbc80bef9/SPUF_2026_20260408.zip",
};

async function rangeReader(url) {
  const head = await fetch(url, { method: "HEAD" });
  const size = Number(head.headers.get("content-length"));
  return {
    size,
    async read(start, length) {
      const response = await fetch(url, {
        headers: { Range: `bytes=${start}-${start + length - 1}` },
      });
      if (response.status !== 206) throw new Error(`Range request failed: ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    },
  };
}

function bufferReader(buffer) {
  return { size: buffer.length, read: async (start, length) => buffer.subarray(start, start + length) };
}

// Minimal zip reader: end-of-central-directory → central directory → stored/deflated members.
// ponytail: no zip64 support; CMS releases are < 4 GB. Swap in yauzl if one ever isn't.
async function zipEntries(reader) {
  const tailLength = Math.min(reader.size, 65_557);
  const tail = await reader.read(reader.size - tailLength, tailLength);
  const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("Not a zip file");
  const count = tail.readUInt16LE(eocd + 10);
  const directory = await reader.read(tail.readUInt32LE(eocd + 16), tail.readUInt32LE(eocd + 12));
  const entries = [];
  for (let offset = 0, index = 0; index < count; index += 1) {
    const nameLength = directory.readUInt16LE(offset + 28);
    entries.push({
      name: directory.toString("latin1", offset + 46, offset + 46 + nameLength),
      method: directory.readUInt16LE(offset + 10),
      compressedSize: directory.readUInt32LE(offset + 20),
      localOffset: directory.readUInt32LE(offset + 42),
    });
    offset += 46 + nameLength + directory.readUInt16LE(offset + 30) + directory.readUInt16LE(offset + 32);
  }
  return entries;
}

async function readEntry(reader, entry) {
  const header = await reader.read(entry.localOffset, 30);
  const dataStart = entry.localOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
  const data = await reader.read(dataStart, entry.compressedSize);
  return entry.method === 0 ? data : inflateRawSync(data);
}

// Members are themselves zips holding one pipe-delimited text file.
async function memberText(outer, entries, namePart) {
  const entry = entries.find(({ name }) => name.toLowerCase().includes(namePart));
  if (!entry) throw new Error(`No member matching "${namePart}"`);
  const inner = bufferReader(await readEntry(outer, entry));
  const [text] = (await zipEntries(inner)).filter(({ name }) => name.endsWith(".txt"));
  return (await readEntry(inner, text)).toString("latin1");
}

function parsePipe(text, keep = () => true) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const columns = header.split("|").map((column) => column.trim());
  return lines
    .map((line) => Object.fromEntries(line.split("|").map((value, i) => [columns[i], value.trim()])))
    .filter(keep);
}

const related = await fetchJson(
  "https://rxnav.nlm.nih.gov/REST/rxcui/136411/related.json?tty=SCD+SBD",
);
const sildenafilRxcuis = new Set(
  related.relatedGroup.conceptGroup.flatMap(({ conceptProperties = [] }) =>
    conceptProperties.map(({ rxcui }) => rxcui),
  ),
);

const plans = [];
const excluded = [];
const formulary = [];
const counties = [];
for (const [year, url] of Object.entries(RELEASES)) {
  const outer = await rangeReader(url);
  const entries = await zipEntries(outer);
  const tag = (row) => ({ plan_year: year, ...row });
  plans.push(...parsePipe(await memberText(outer, entries, "plan information")).map(tag));
  excluded.push(...parsePipe(await memberText(outer, entries, "excluded drugs")).map(tag));
  formulary.push(
    ...parsePipe(await memberText(outer, entries, "basic drugs formulary"), ({ RXCUI }) =>
      sildenafilRxcuis.has(RXCUI),
    ).map(tag),
  );
  counties.push(...parsePipe(await memberText(outer, entries, "geographic locator")).map(tag));
  console.log(`${year}: ${plans.length} plan rows, ${excluded.length} excluded rows so far`);
}
await writeCsv("formulary-plans.csv", plans);
await writeCsv("formulary-excluded.csv", excluded);
await writeCsv("formulary-sildenafil.csv", formulary);
await writeCsv("formulary-counties.csv", counties);
