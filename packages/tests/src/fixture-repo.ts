import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { TestContext } from "./types.js";

const execFileAsync = promisify(execFile);

export type FixtureRepo = {
  path: string;
  cleanup: () => Promise<void>;
};

export async function createFixtureRepo(context: TestContext, owner: string): Promise<FixtureRepo> {
  const root = path.join(
    context.tmpDir,
    `${owner}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  await mkdir(path.join(root, "lib"), { recursive: true });
  await mkdir(path.join(root, "test"), { recursive: true });

  await writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify(
      {
        name: `togetherlink-fixture-${owner}`,
        private: true,
        type: "module",
        scripts: { test: "node --test" },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(root, "README.md"),
    [
      "# Stats Fixture",
      "",
      "This tiny repo is used by togetherlink live agent tests.",
      "",
      "Implemented functions:",
      "- sum(numbers)",
      "- average(numbers)",
      "",
    ].join("\n"),
  );
  await writeFile(
    path.join(root, "lib/stats.js"),
    [
      "export function sum(numbers) {",
      "  return numbers.reduce((total, value) => total + value, 0);",
      "}",
      "",
      "export function average(numbers) {",
      "  if (numbers.length === 0) return 0;",
      "  return sum(numbers) / numbers.length;",
      "}",
      "",
    ].join("\n"),
  );
  await writeFile(
    path.join(root, "test/stats.test.js"),
    [
      "import test from 'node:test';",
      "import assert from 'node:assert/strict';",
      "import { average, sum } from '../lib/stats.js';",
      "",
      "test('sum adds numbers', () => {",
      "  assert.equal(sum([1, 2, 3, 4]), 10);",
      "});",
      "",
      "test('average handles numbers', () => {",
      "  assert.equal(average([2, 4, 6, 8]), 5);",
      "});",
      "",
    ].join("\n"),
  );
  await writeFile(path.join(root, ".gitignore"), "node_modules/\n");

  await execFileAsync("git", ["init"], { cwd: root });
  await execFileAsync("git", ["add", "."], { cwd: root });
  await execFileAsync("git", ["commit", "-m", "Initial fixture"], {
    cwd: root,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "togetherlink tests",
      GIT_AUTHOR_EMAIL: "tests@togetherlink.local",
      GIT_COMMITTER_NAME: "togetherlink tests",
      GIT_COMMITTER_EMAIL: "tests@togetherlink.local",
    },
  });

  return {
    path: root,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

export function codingTaskPrompt(): string {
  return [
    "You are in a temporary Git repo. Make a real code change and verify it.",
    "",
    "Tasks:",
    "1. Inspect the repo files.",
    "2. Add a median(numbers) export to lib/stats.js. For an empty array return 0. Do not mutate the input array.",
    "3. Add tests for median in test/stats.test.js, including odd length, even length, unsorted input, and empty input.",
    "4. Update README.md so the implemented functions list includes median(numbers).",
    "5. Run node --test.",
    "6. Reply with the final test command and a one-sentence summary.",
  ].join("\n");
}
