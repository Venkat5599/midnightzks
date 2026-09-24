#!/usr/bin/env bash
# Compile the Triện circuits with the Compact toolchain.
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

# The key generator (`zkir`) is built for CPUs with the ADX instruction. Older
# AMD parts do not have it, and the failure is a SIGILL that arrives *after* the
# compiler has already wiped the output directory — so a machine without ADX
# loses the committed artifacts and reports it as `exit status -4`. Check first,
# and say what the problem is.
if [ -r /proc/cpuinfo ] && ! grep -qm1 '^flags.*\badx\b' /proc/cpuinfo; then
  echo "This CPU has no ADX, so the Compact key generator will crash (exit status -4)." >&2
  echo "Compile on a machine that has it — CI does exactly this on every push — and" >&2
  echo "copy src/managed/trien/ back. Tests do not need keys; they run against the" >&2
  echo "committed artifacts." >&2
  exit 1
fi

compact --version
echo
compact compile src/trien.compact src/managed/trien
