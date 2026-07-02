export async function runNativeWebSearchCall({
  name,
  priorUses,
  maxUses,
  isWebSearch,
  recordUse,
  runSearch,
}: {
  name: string;
  priorUses: number;
  maxUses: number;
  isWebSearch: boolean;
  recordUse: () => void;
  runSearch: () => Promise<string>;
}): Promise<string> {
  if (priorUses >= maxUses) {
    return `Web search error: max_uses_exceeded for ${name}. Do not call this tool again; answer from the results already provided or say search is unavailable.`;
  }
  if (!isWebSearch) {
    return "Unsupported native server tool.";
  }
  recordUse();
  return await runSearch();
}
