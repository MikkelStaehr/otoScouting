"""Ingest progress channel — a single JSON status file the Next app polls.

The orchestrator (ingest.py) owns the state and writes `.ingest-status.json`
atomically on every transition; the app reads it via /api/ingest/status. Kept
deliberately simple (one file, no sockets) so it survives a closed tab, a reload,
or a 30-minute run. Every call is defensive: a progress failure must never sink
the pipeline itself.
"""

from __future__ import annotations

import json
import os
import tempfile
import time
from pathlib import Path

STATUS_PATH = Path(__file__).resolve().parent / ".ingest-status.json"
LOG_KEEP = 18  # rolling log-tail length shown in the UI

_state: dict = {}


def _now_ms() -> int:
    return int(time.time() * 1000)


def _write() -> None:
    """Atomic write (temp + rename) so a poller never reads a half-written file."""
    try:
        fd, tmp = tempfile.mkstemp(dir=str(STATUS_PATH.parent), suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(_state, f)
        os.replace(tmp, STATUS_PATH)
    except Exception:
        pass  # progress is best-effort; never break ingest


def start(mode: str, steps: list[str], leagues: list[str]) -> None:
    _state.clear()
    _state.update(
        {
            "running": True,
            "mode": mode,
            "pid": os.getpid(),
            "startedAt": _now_ms(),
            "finishedAt": None,
            "phase": "starting",
            "phaseLabel": "Starter…",
            "steps": [{"key": k, "status": "pending"} for k in steps],
            "leagues": {k: "pending" for k in leagues},
            "logTail": [],
            "error": None,
        }
    )
    _write()


def phase(phase: str, label: str) -> None:
    _state["phase"] = phase
    _state["phaseLabel"] = label
    _write()


def step(key: str, status: str, seconds: float | None = None) -> None:
    for s in _state.get("steps", []):
        if s["key"] == key:
            s["status"] = status
            if seconds is not None:
                s["seconds"] = round(seconds)
            break
    _write()


def league(key: str, status: str) -> None:
    _state.setdefault("leagues", {})[key] = status
    _write()


def log(line: str) -> None:
    line = (line or "").strip()
    if not line:
        return
    tail = _state.setdefault("logTail", [])
    tail.append(line[:200])
    del tail[:-LOG_KEEP]
    _write()


def finish(error: str | None = None) -> None:
    _state["running"] = False
    _state["finishedAt"] = _now_ms()
    _state["error"] = error
    _state["phase"] = "done"
    _state["phaseLabel"] = f"Fejlet: {error}" if error else "Færdig"
    _write()
