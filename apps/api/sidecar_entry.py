"""PyInstaller entrypoint for the packaged Atlas API sidecar.

`python -m uvicorn app.main:app` (the documented dev flow) relies on module discovery against a
source tree, which PyInstaller cannot freeze - it needs a concrete script that imports the ASGI
app object directly and calls into uvicorn's programmatic API instead of its CLI.

Build from apps/api:
    pyinstaller --onefile --name atlas-api --distpath dist --workpath build sidecar_entry.py

The desktop Electron shell spawns the resulting binary with --host/--port args matching the
uvicorn CLI's flag names, so main.js does not need separate branching for dev-source vs. packaged
argument shapes.
"""

from __future__ import annotations

import sys

import uvicorn

from app.main import app


def _arg_value(flag: str, default: str) -> str:
    args = sys.argv[1:]
    if flag in args:
        index = args.index(flag)
        if index + 1 < len(args):
            return args[index + 1]
    return default


def main() -> None:
    host = _arg_value("--host", "127.0.0.1")
    port = int(_arg_value("--port", "8756"))
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
