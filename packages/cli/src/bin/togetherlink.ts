#!/usr/bin/env node
import { parseArgs } from "../lib/parse-args.js";
import { printHelp, runConfigure } from "../lib/commands/global.js";
import { dispatchHarnessCommand } from "../lib/commands/harness.js";

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [command, verb] = positional;

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "configure") {
    await runConfigure();
    return;
  }

  if (command === "uninstall") {
    console.log("`uninstall` isn't built yet — for now, run `<harness> off` for each configured harness.");
    return;
  }

  await dispatchHarnessCommand(command, verb, flags);
}

main().catch((err: unknown) => {
  if (!(err instanceof Error)) {
    console.error(`Error: ${String(err)}`);
    process.exitCode = 1;
    return;
  }
  console.error(`Error: ${err.message}`);
  process.exitCode = 1;
});
