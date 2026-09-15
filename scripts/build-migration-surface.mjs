import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const manifestPath = path.resolve("migration-public/latest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (
  typeof manifest.version !== "string" ||
  typeof manifest.url !== "string" ||
  manifest.channel !== "migration"
) {
  throw new Error(`Invalid legacy migration manifest: ${manifestPath}`);
}

const requestedOutput = process.argv[2];
const outputs = requestedOutput
  ? [path.resolve(requestedOutput)]
  : [path.resolve("migration-public")];

for (const output of outputs) {
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

process.stdout.write(`Prepared v${manifest.version} legacy migration manifest.\n`);
