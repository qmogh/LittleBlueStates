import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const INPUT_PATH = resolve("src/data/provider-footprint-2024.json");
const HISTORY_PATH = resolve("src/data/provider-footprint-history.json");
const OUTPUT_PATH = resolve("src/data/provider-city-coordinates-2024.json");
const GAZETTEER_BASE =
  "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer";
const stateFips = {
  AL: "01",
  AK: "02",
  AZ: "04",
  AR: "05",
  CA: "06",
  CO: "08",
  CT: "09",
  DE: "10",
  DC: "11",
  FL: "12",
  GA: "13",
  HI: "15",
  ID: "16",
  IL: "17",
  IN: "18",
  IA: "19",
  KS: "20",
  KY: "21",
  LA: "22",
  ME: "23",
  MD: "24",
  MA: "25",
  MI: "26",
  MN: "27",
  MS: "28",
  MO: "29",
  MT: "30",
  NE: "31",
  NV: "32",
  NH: "33",
  NJ: "34",
  NM: "35",
  NY: "36",
  NC: "37",
  ND: "38",
  OH: "39",
  OK: "40",
  OR: "41",
  PA: "42",
  RI: "44",
  SC: "45",
  SD: "46",
  TN: "47",
  TX: "48",
  UT: "49",
  VT: "50",
  VA: "51",
  WA: "53",
  WV: "54",
  WI: "55",
  WY: "56",
  PR: "72",
};

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/\bsaint\b/g, "st")
    .replace(
      /\s+(city|town|village|borough|municipio|municipality|cdp|zona urbana|consolidated government \(balance\))$/i,
      "",
    )
    .replace(/[^a-z0-9]/g, "");
}

async function placesForState(code, fips) {
  const response = await fetch(`${GAZETTEER_BASE}/2024_gaz_place_${fips}.txt`);
  if (!response.ok)
    throw new Error(
      `Census places request failed for ${code}: ${response.status}`,
    );
  const [header, ...rows] = (await response.text()).trim().split(/\r?\n/);
  const columns = header.trim().split(/\t+/);
  const index = Object.fromEntries(columns.map((column, i) => [column, i]));
  return new Map(
    rows.map((row) => {
      const fields = row.trim().split(/\t+/);
      return [
        normalize(fields[index.NAME]),
        {
          latitude: Number(fields[index.INTPTLAT]),
          longitude: Number(fields[index.INTPTLONG]),
        },
      ];
    }),
  );
}

const footprint = JSON.parse(await readFile(INPUT_PATH, "utf8"));
const history = JSON.parse(await readFile(HISTORY_PATH, "utf8"));
const placeMaps = new Map(
  await Promise.all(
    Object.entries(stateFips).map(async ([code, fips]) => [
      code,
      await placesForState(code, fips),
    ]),
  ),
);
const cities = [];
const unmatched = [];

for (const year of [
  ...history.yearly,
  { year: footprint.metadata.year, states: footprint.states },
]) {
  for (const state of year.states) {
    const places = placeMaps.get(state.code);
    for (const city of state.cities.slice(0, 5)) {
      const key = normalize(city.city);
      const exact = places?.get(key);
      const fallback = exact
        ? undefined
        : [...(places?.entries() ?? [])].find(
            ([place]) => place.startsWith(key) || key.startsWith(place),
          )?.[1];
      const point = exact ?? fallback;
      if (!point) {
        unmatched.push(`${year.year} ${state.code}: ${city.city}`);
        continue;
      }
      cities.push({
        year: year.year,
        state: state.code,
        city: city.city,
        ...point,
      });
    }
  }
}

await writeFile(
  OUTPUT_PATH,
  `${JSON.stringify(
    {
      metadata: {
        source: "U.S. Census Bureau 2024 Gazetteer Files — Places",
        sourceUrl: GAZETTEER_BASE,
        scope:
          "Interior point coordinates matched to the top five CMS prescriber-practice cities in each state or territory and year.",
      },
      cities,
    },
    null,
    2,
  )}\n`,
);
console.log(
  `Wrote ${cities.length} city coordinates; ${unmatched.length} were not Census-place matches.`,
);
if (unmatched.length) console.log(`Unmatched: ${unmatched.join("; ")}`);
