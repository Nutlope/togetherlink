import { readFileSync } from "node:fs";

/**
 * Single source of truth for the CLI version. Release bundles receive the
 * root package version from `scripts/build-bundle.sh`; local `tsc` builds read
 * the CLI package.json next to the compiled dist output.
 */
export const VERSION: string =
  process.env.TOGETHERLINK_VERSION ?? readPackageVersion() ?? "0.0.0-dev";

function readPackageVersion(): string | undefined {
  try {
    const packageJsonUrl = new URL("../../package.json", import.meta.url);
    const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8")) as { version?: unknown };
    return typeof packageJson.version === "string" ? packageJson.version : undefined;
  } catch {
    return undefined;
  }
}
