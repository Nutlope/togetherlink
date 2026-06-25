#!/usr/bin/env bash
# Build the single cross-platform Bun-target JS bundle for distribution.
#
# The CLI is pure JS (only node: child_process/http/fs/os/crypto — all
# Bun-compatible, no native modules), so one bundle runs on every OS/arch
# when executed with `bun run`. The version from the root package.json is
# baked in via --define so the binary's self-update check knows its version.
#
# Output: site/public/togetherlink.js for the Vercel static build, mirrored to
# tracked site/* artifacts so manual/static release flows stay in sync too.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Version is the single source of truth from the root package.json.
VERSION="$(node -p "require('./package.json').version")"
echo "Building togetherlink v${VERSION} bundle…"

# The CLI depends on the workspace @togetherlink/models package, so build that
# first so `bun build` can resolve and inline it into the bundle.
pnpm --filter @togetherlink/models build

PUBLIC_DIR="$ROOT/site/public"
TRACKED_DIR="$ROOT/site"
mkdir -p "$PUBLIC_DIR"
cp "$ROOT/scripts/install.sh" "$PUBLIC_DIR/install.sh"
cp "$ROOT/scripts/install.sh" "$TRACKED_DIR/install.sh"
echo "✓ installer → site/public/install.sh and site/install.sh"

# Bundle the CLI entry. --target=bun keeps Bun-only runtime assumptions; the
# result is a single self-contained JS file with models inlined.
bun build \
  "$ROOT/packages/cli/src/bin/togetherlink.ts" \
  --target=bun \
  --production \
  --define "process.env.TOGETHERLINK_VERSION=\"${VERSION}\"" \
  --outfile "$PUBLIC_DIR/togetherlink.js"

cp "$PUBLIC_DIR/togetherlink.js" "$TRACKED_DIR/togetherlink.js"
echo "✓ bundle → site/public/togetherlink.js and site/togetherlink.js ($(wc -c < "$PUBLIC_DIR/togetherlink.js") bytes)"

# Refresh the manifest the auto-updater and install script read.
node -e "
const fs = require('node:fs');
const version = '${VERSION}';
const manifest = {
  version,
  url: 'https://togetherlink.vercel.app/togetherlink.js',
  publishedAt: new Date().toISOString(),
};
const json = JSON.stringify(manifest, null, 2) + '\n';
fs.writeFileSync('$PUBLIC_DIR/latest.json', json);
fs.writeFileSync('$TRACKED_DIR/latest.json', json);
console.log('✓ manifest → site/public/latest.json and site/latest.json (v' + version + ')');
"
