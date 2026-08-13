import { spawn } from "node:child_process";
import { detectInstalledHarness, missingHarnessMessage, type HarnessDetection } from "./detect.js";
import { HARNESS, HARNESS_BIN, HARNESS_LABEL, type HarnessId } from "./harness.js";

type InstallRunner = (command: string, args: string[]) => Promise<number | null>;

type InstallHarnessOptions = {
  detect?: (harness: HarnessId) => HarnessDetection;
  run?: InstallRunner;
};

type HarnessInstallSpec = {
  command: string;
  args: string[];
};

/** Harnesses explicitly allowed to install themselves after direct invocation. */
const DEMAND_INSTALLERS: Partial<Record<HarnessId, HarnessInstallSpec>> = {
  [HARNESS.DEEPSEEK]: {
    command: "npm",
    args: ["install", "-g", "@deepseek-ai/dsh"],
  },
};

function runInstaller(command: string, args: string[]): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (status) => resolve(status));
  });
}

/**
 * Ensure an explicitly invoked harness is installed.
 *
 * Only harnesses in {@link DEMAND_INSTALLERS} may install themselves. This is
 * called from harness dispatch, after a command or picker selection exists, so
 * startup, configure, detection, and self-update never install anything.
 */
export async function ensureHarnessInstalled(
  harness: HarnessId,
  options: InstallHarnessOptions = {},
): Promise<boolean> {
  const detect = options.detect ?? detectInstalledHarness;
  if (detect(harness).installed) {
    return false;
  }

  const installer = DEMAND_INSTALLERS[harness];
  if (!installer) {
    throw new Error(missingHarnessMessage(harness));
  }

  const run = options.run ?? runInstaller;
  process.stderr.write(
    `togetherlink ▸ ${HARNESS_LABEL[harness]} is not installed; installing it now…\n`,
  );
  const status = await run(installer.command, [...installer.args]);
  if (status !== 0) {
    throw new Error(
      `Could not install ${HARNESS_LABEL[harness]} (npm exited with status ${status ?? "unknown"}).\n${missingHarnessMessage(harness)}`,
    );
  }
  if (!detect(harness).installed) {
    throw new Error(
      `${HARNESS_LABEL[harness]} installed, but "${HARNESS_BIN[harness]}" is still not on PATH. Open a new shell and re-run: togetherlink ${harness}`,
    );
  }

  process.stderr.write(`togetherlink ▸ ${HARNESS_LABEL[harness]} installed. Launching…\n`);
  return true;
}
