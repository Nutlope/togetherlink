import path from "node:path";
import { realpath } from "node:fs/promises";
import { togetherlinkHome } from "../paths.js";

export async function runningFromBundle(): Promise<boolean> {
  const home = togetherlinkHome();
  const bundleExecutablePaths = new Set([
    path.join(home, "bin", "togetherlink.js"),
    path.join(home, "bin", "togetherlink"),
  ]);

  // Primary heuristic: the executed script itself resolves to the installed
  // bundle executable. This is robust for the normal installed binary.
  const argv1 = process.argv[1];
  if (argv1) {
    try {
      const resolved = await realpath(argv1);
      if (bundleExecutablePaths.has(resolved)) return true;
    } catch {
      // fall through
    }
  }

  return false;
}
