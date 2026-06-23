#!/usr/bin/env bash
# togetherlink installer.
#
#   curl -fsSL https://togetherlink.vercel.app/install.sh | sh
#
# Installs the togetherlink CLI as a Bun-target JS bundle at
# ~/.togetherlink/bin/togetherlink.js, with a `togetherlink` wrapper script on
# PATH that runs it with `bun`. Installs Bun for the user if `bun` isn't on
# PATH. Also installs `tclaude` and `topencode` convenience wrappers.
#
# After install, the CLI prompts once for a Together API key on first use
# (Enter skips — the key is optional). The CLI self-updates in the background.

set -euo pipefail

ORIGIN="${TOGETHERLINK_ORIGIN:-https://togetherlink.vercel.app}"
INSTALL_DIR="${TOGETHERLINK_HOME:-$HOME/.togetherlink}"
BIN_DIR="$INSTALL_DIR/bin"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
info() { printf "  %s\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
err()  { printf "  \033[31m✗ %s\033[0m\n" "$1" >&2; }

bold "Installing togetherlink…"

# --- 1. Ensure Bun is present (install it for the user if not) ----------------
if command -v bun >/dev/null 2>&1; then
  ok "Bun found: $(bun --version)"
else
  info "Bun not found — installing it for you…"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL https://bun.sh/install | bash
  elif command -v fetch >/dev/null 2>&1; then
    fetch -o - https://bun.sh/install | sh
  else
    err "Need curl to install Bun. Please install curl and re-run."
    exit 1
  fi
  # bun.sh writes to ~/.bun; add to PATH for this script's later bun calls.
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  if ! command -v bun >/dev/null 2>&1; then
    err "Bun install finished but bun isn't on PATH. Open a new shell and re-run."
    exit 1
  fi
  ok "Bun installed: $(bun --version)"
fi

# --- 2. Download the latest bundle + manifest --------------------------------
mkdir -p "$BIN_DIR"
info "Downloading togetherlink from $ORIGIN …"

if ! curl -fsSL "$ORIGIN/togetherlink.js" -o "$BIN_DIR/togetherlink.js"; then
  err "Failed to download $ORIGIN/togetherlink.js"
  exit 1
fi
ok "Bundle saved → $BIN_DIR/togetherlink.js"

# --- 3. Write the `togetherlink` wrapper that runs the bundle with bun --------
cat > "$BIN_DIR/togetherlink" <<EOF
#!/usr/bin/env sh
# togetherlink launcher — runs the installed Bun-target JS bundle.
exec bun "$BIN_DIR/togetherlink.js" "\$@"
EOF
chmod +x "$BIN_DIR/togetherlink"

# Short aliases: tclaude / topencode
cat > "$BIN_DIR/tclaude" <<EOF
#!/usr/bin/env sh
exec bun "$BIN_DIR/togetherlink.js" claude "\$@"
EOF
chmod +x "$BIN_DIR/tclaude"

cat > "$BIN_DIR/topencode" <<EOF
#!/usr/bin/env sh
exec bun "$BIN_DIR/togetherlink.js" opencode "\$@"
EOF
chmod +x "$BIN_DIR/topencode"

ok "Wrappers installed: togetherlink, tclaude, topencode → $BIN_DIR"

# --- 4. Help the user get it on PATH -----------------------------------------
path_line="export PATH=\"$BIN_DIR:\$PATH\""

detect_shell_rc() {
  case "${SHELL:-}" in
    */zsh)  printf "%s/.zshrc" "$HOME" ;;
    */bash) printf "%s/.bashrc" "$HOME" ;;
    *)      printf "%s/.profile" "$HOME" ;;
  esac
}

case ":$PATH:" in
  *":$BIN_DIR:"*) ok "Already on PATH" ;;
  *)
    SHELL_RC="$(detect_shell_rc)"
    mkdir -p "$(dirname "$SHELL_RC")"
    touch "$SHELL_RC"

    if grep -Fqs "$path_line" "$SHELL_RC"; then
      ok "PATH already configured in $SHELL_RC"
    else
      {
        printf "\n# togetherlink\n"
        printf "%s\n" "$path_line"
      } >> "$SHELL_RC"
      ok "Added togetherlink to PATH in $SHELL_RC"
    fi

    info "Restart your shell, or run this now:"
    info "  export PATH=\"$BIN_DIR:\$PATH\""
    ;;
esac

# Verify the install works right now if already on PATH, else with explicit PATH.
if PATH="$BIN_DIR:$PATH" togetherlink --version >/dev/null 2>&1; then
  ok "Verified: $(PATH="$BIN_DIR:$PATH" togetherlink --version)"
fi

bold "Done. Run \`togetherlink help\` to get started."
info "On first run, togetherlink will ask for your Together API key (Enter to skip)."
