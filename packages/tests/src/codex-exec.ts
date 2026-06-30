// GitHub-hosted Linux runners cannot initialize Codex's bwrap sandbox loopback
// device, so controlled live tool probes rely on the runner sandbox instead.
const CODEX_LOCAL_TOOL_ARGS = ["--dangerously-bypass-approvals-and-sandbox"] as const;

export function codexExecArgs(
  prompt: string,
  options: { allowLocalTools?: boolean; extraArgs?: string[] } = {},
): string[] {
  return [
    "exec",
    "--json",
    "--ephemeral",
    "--skip-git-repo-check",
    ...(options.allowLocalTools ? CODEX_LOCAL_TOOL_ARGS : []),
    "--ignore-user-config",
    "--ignore-rules",
    ...(options.extraArgs ?? []),
    prompt,
  ];
}
