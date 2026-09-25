import { readFile, mkdir, writeFile } from "node:fs/promises";
import { analyzeIncident } from "../lib/orchestrator.ts";
import { demoProvider } from "../lib/providers/demo.ts";
import { incidentBrief } from "../lib/brief.ts";

const dir = new URL("../../docs/samples/", import.meta.url);
await mkdir(dir, { recursive: true });
for (const name of ["well-evidenced", "ambiguous", "redaction-test"]) {
  const input = await readFile(
    new URL(`../fixtures/${name}.txt`, import.meta.url),
    "utf8",
  );
  // Fixed clock makes samples diffable. This is not a claimed execution time.
  const result = await analyzeIncident(input, demoProvider, {
    now: () => "2026-09-24T00:00:00.000Z",
  });
  await writeFile(
    new URL(`${name}.json`, dir),
    JSON.stringify(result, null, 2) + "\n",
  );
  await writeFile(new URL(`${name}.md`, dir), incidentBrief(result));
  console.log(`${name}: ${result.state}`);
}
