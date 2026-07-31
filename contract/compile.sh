#!/usr/bin/env bash
# Compile the Gatekeeper circuits with the Compact toolchain.
#
# The compiler ships for Linux and macOS only, so on Windows this is run
# through WSL: `wsl -d Ubuntu -- bash contract/compile.sh`.
#
# PATH is reset rather than inherited, for two reasons. Windows has its own
# unrelated `compact.exe` (the NTFS compression tool) that otherwise shadows
# this one, and WSL's interop PATH is full of unquoted spaces and parentheses
# which break `bash -lc` outright.
set -euo pipefail

export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"

cd "$(dirname "$0")"

compact --version
echo
compact compile src/gatekeeper.compact src/managed/gatekeeper
