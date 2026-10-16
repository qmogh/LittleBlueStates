// Runs sql/_views.sql, then each sql/NN-*.sql story query, and writes one JSON per query file
// to src/data/story/. Inside a query file, each `-- @output <key>` block becomes outputs[key].
// Usage: node scripts/build-story.mjs [file-filter]
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";

const SQL_DIR = resolve("sql");
const OUT_DIR = resolve("src/data/story");
const filter = process.argv[2] ?? "";

const db = await DuckDBInstance.create(":memory:");
const connection = await db.connect();
await connection.run(await readFile(resolve(SQL_DIR, "_views.sql"), "utf8"));

const files = (await readdir(SQL_DIR))
  .filter((file) => /^\d\d-.*\.sql$/.test(file) && file.includes(filter))
  .sort();
await mkdir(OUT_DIR, { recursive: true });

for (const file of files) {
  const text = await readFile(resolve(SQL_DIR, file), "utf8");
  const [preamble, ...blocks] = text.split(/^-- @output /m);
  if (preamble.replace(/^--.*$/gm, "").trim()) await connection.run(preamble);
  const outputs = {};
  for (const block of blocks) {
    const [key, ...body] = block.split("\n");
    const reader = await connection
      .runAndReadAll(body.join("\n"))
      .catch((error) => {
        throw new Error(`${file} → ${key.trim()}: ${error.message}`);
      });
    // DuckDB serializes 64-bit+ integers and decimals as strings; story data wants numbers.
    const numeric = reader
      .columnTypes()
      .map((type) => /^(BIGINT|HUGEINT|UBIGINT|DECIMAL)/.test(type.toString()));
    const names = reader.columnNames();
    outputs[key.trim()] = reader.getRowObjectsJson().map((row) =>
      Object.fromEntries(
        names.map((name, i) => [name, numeric[i] && row[name] !== null ? Number(row[name]) : row[name]]),
      ),
    );
  }
  const name = file.replace(/\.sql$/, "");
  await writeFile(
    resolve(OUT_DIR, `${name}.json`),
    `${JSON.stringify({ query: `sql/${file}`, outputs }, null, 2)}\n`,
  );
  console.log(`${file}: ${Object.keys(outputs).join(", ")}`);
}
