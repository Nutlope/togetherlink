import { mkdtemp, mkdir, readFile, readlink, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { ensureInstalledWrappers } from "../../cli/src/lib/autoupdate.js";

describe("autoupdate installed wrappers", () => {
  const cleanup: string[] = [];

  afterEach(async () => {
    await Promise.all(cleanup.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  test("adds newly released wrappers without replacing existing launchers", async () => {
    const installDir = await mkdtemp(path.join(tmpdir(), "togetherlink-update-wrappers-"));
    cleanup.push(installDir);
    const binDir = path.join(installDir, "bin");
    const pathDir = path.join(installDir, "path-bin");
    const bundlePath = path.join(binDir, "togetherlink.js");
    const existingLauncher = "#!/usr/bin/env sh\n# keep this local launcher\n";
    const existingPathCommand = "#!/usr/bin/env sh\n# keep this PATH command\n";

    await mkdir(binDir, { recursive: true });
    await mkdir(pathDir, { recursive: true });
    await writeFile(path.join(binDir, "togetherlink"), existingLauncher, { mode: 0o755 });
    await writeFile(path.join(pathDir, "togetherlink"), existingPathCommand, { mode: 0o755 });

    await ensureInstalledWrappers(installDir, { PATH: pathDir });

    expect(await readFile(path.join(binDir, "togetherlink"), "utf8")).toBe(existingLauncher);
    expect(await readFile(path.join(pathDir, "togetherlink"), "utf8")).toBe(existingPathCommand);
    expect(await readFile(path.join(binDir, "tprime"), "utf8")).toBe(
      `#!/usr/bin/env sh\nexec bun '${bundlePath}' prime "$@"\n`,
    );
    if (process.platform !== "win32") {
      expect((await stat(path.join(binDir, "tprime"))).mode & 0o100).toBe(0o100);
      expect(await readlink(path.join(pathDir, "tprime"))).toBe(path.join(binDir, "tprime"));
    }
  });
});
