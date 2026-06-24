import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(dirname, "../../..");
export const cliBin = path.join(repoRoot, "packages/cli/dist/bin/togetherlink.js");
export const artifactsDir = path.join(repoRoot, "packages/tests/artifacts");
export const tmpDir = path.join(repoRoot, "packages/tests/tmp");
