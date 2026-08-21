import { mkdtemp, mkdir, readFile, readlink, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ensureInstalledWrappers, forceSelfUpdate } from "../../cli/src/lib/autoupdate.js";

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
    expect(await readFile(path.join(binDir, "tdeepseek"), "utf8")).toBe(
      `#!/usr/bin/env sh\nexec bun '${bundlePath}' deepseek "$@"\n`,
    );
    expect(await readFile(path.join(binDir, "tchatgpt"), "utf8")).toBe(
      `#!/usr/bin/env sh\nexec bun '${bundlePath}' chatgpt "$@"\n`,
    );
    if (process.platform !== "win32") {
      expect((await stat(path.join(binDir, "tprime"))).mode & 0o100).toBe(0o100);
      expect(await readlink(path.join(pathDir, "tprime"))).toBe(path.join(binDir, "tprime"));
      expect((await stat(path.join(binDir, "tdeepseek"))).mode & 0o100).toBe(0o100);
      expect(await readlink(path.join(pathDir, "tdeepseek"))).toBe(path.join(binDir, "tdeepseek"));
      expect((await stat(path.join(binDir, "tchatgpt"))).mode & 0o100).toBe(0o100);
      expect(await readlink(path.join(pathDir, "tchatgpt"))).toBe(path.join(binDir, "tchatgpt"));
    }
  });

  test("force update bypasses the throttle and replaces an older installed bundle", async () => {
    const installDir = await mkdtemp(path.join(tmpdir(), "togetherlink-force-update-"));
    cleanup.push(installDir);
    const binDir = path.join(installDir, "bin");
    const bundlePath = path.join(binDir, "togetherlink.js");
    await mkdir(binDir, { recursive: true });
    await writeFile(bundlePath, "old bundle");
    await writeFile(path.join(installDir, ".update-check"), "");

    const originalArgv1 = process.argv[1];
    const originalHome = process.env.TOGETHERLINK_HOME;
    const originalPath = process.env.PATH;
    process.argv[1] = bundlePath;
    process.env.TOGETHERLINK_HOME = installDir;
    process.env.PATH = binDir;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ version: "99.0.0", url: "https://example.test/togetherlink.js" }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response("new bundle", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(forceSelfUpdate()).resolves.toEqual({
        status: "updated",
        version: "99.0.0",
      });
      expect(await readFile(bundlePath, "utf8")).toBe("new bundle");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      process.argv[1] = originalArgv1;
      if (originalHome === undefined) delete process.env.TOGETHERLINK_HOME;
      else process.env.TOGETHERLINK_HOME = originalHome;
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
      vi.unstubAllGlobals();
    }
  });
});
