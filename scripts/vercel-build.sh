#!/usr/bin/env bash
# Vercel Preview builds must not use the production Convex deploy key.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "${VERCEL_ENV:-}" == "production" ]]; then
  pnpm --dir site exec convex deploy --cmd-url-env-var-name CONVEX_URL --cmd 'pnpm --dir .. build:site'
else
  pnpm build:site:preview
fi
