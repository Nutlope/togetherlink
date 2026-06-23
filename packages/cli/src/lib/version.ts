/**
 * Single source of truth for the CLI version. The value is normally the version
 * in the root package.json, which `scripts/build-bundle.sh` injects at build
 * time via `bun build --define 'process.env.TOGETHERLINK_VERSION="x.y.z"'`.
 * The fallback is used when running from source via `tsc`/node directly.
 */
export const VERSION: string = process.env.TOGETHERLINK_VERSION ?? "0.0.0-dev";