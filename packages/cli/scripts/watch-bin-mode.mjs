import { chmodSync, existsSync, watch } from "node:fs";
import { dirname, resolve } from "node:path";

const binPath = resolve("dist/bin/togetherlink.js");
const binDir = dirname(binPath);

function chmodBin() {
  if (!existsSync(binPath)) {
    return;
  }
  chmodSync(binPath, 0o755);
}

chmodBin();

if (!existsSync(binDir)) {
  process.exit(0);
}

watch(binDir, { persistent: true }, chmodBin);
