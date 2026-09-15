import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const manifest = {
  version: "0.9.0",
  url: "https://gateway.togetherlink.dev/legacy-migrate.js",
  channel: "migration",
};

const requestedOutput = process.argv[2];
const outputs = requestedOutput
  ? [path.resolve(requestedOutput)]
  : [path.resolve("migration-public")];

for (const output of outputs) {
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

process.stdout.write(`Prepared v${manifest.version} legacy migration manifest.\n`);
